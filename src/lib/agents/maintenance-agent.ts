import { revalidatePath } from "next/cache";

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAgentRunStep } from "@/lib/agents/audit";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { loadAgentContext } from "@/lib/agents/context-loader";
import { assertStepBudget } from "@/lib/agents/ota-loop";
import { readAgentFile } from "@/lib/agents/paths";
import { sendEmailTool } from "@/lib/tools/send-email";
import { createClient } from "@/lib/supabase/server";

const OTA_MAX = 5;

export type TriageCategory = "urgent-safety" | "urgent" | "routine" | "low-priority";

export type TriageResult = {
  category: TriageCategory;
  responseTime: string;
  recommendedAction: string;
  summary: string;
};

export type MaintenanceAgentResult = {
  success: boolean;
  agentRunId: string | null;
  triageCategory: string | null;
  tenantEmailStatus: "sent" | "draft" | "failed";
  landlordEmailStatus: "sent" | "draft" | "failed";
  message?: string;
};

function refShort(maintenanceRequestId: string): string {
  return maintenanceRequestId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Parsed from `Issue: …\n\n…` stored description (see addMaintenanceRequest). */
function splitStoredMaintenanceDescription(stored: string): { issueTitle: string; issueBody: string } {
  const m = stored.match(/^Issue:\s*([^\n]+)(?:\n\n([\s\S]*))?$/);
  if (m) {
    return { issueTitle: (m[1] ?? "").trim(), issueBody: (m[2] ?? "").trim() };
  }
  const lines = stored.split(/\n/);
  return { issueTitle: (lines[0] ?? "").trim(), issueBody: lines.slice(1).join("\n").trim() };
}

function colourIndicator(category: TriageCategory): string {
  switch (category) {
    case "urgent-safety":
      return "(RED — safety)";
    case "urgent":
      return "(ORANGE)";
    case "routine":
      return "(AMBER)";
    case "low-priority":
    default:
      return "(GREY)";
  }
}

function normalizeCategory(raw: string | undefined): TriageCategory {
  const s = (raw ?? "").toLowerCase().trim();
  if (s === "urgent-safety" || s === "urgent_safety") return "urgent-safety";
  if (s === "urgent") return "urgent";
  if (s === "low-priority" || s === "low_priority") return "low-priority";
  if (s === "routine") return "routine";
  return "routine";
}

function fallbackTriage(description: string): TriageResult {
  const summary =
    description.length > 120 ? `${description.slice(0, 117)}...` : description;
  return {
    category: "routine",
    responseTime: "Within 7 days",
    recommendedAction: "Review the request and arrange inspection if needed",
    summary: summary || "Maintenance issue reported",
  };
}

async function generateTriage(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  systemContext: string,
  title: string,
  description: string,
  priority: string,
): Promise<TriageResult> {
  const month = new Date().getUTCMonth() + 1;
  const heatingSeason = month >= 11 || month <= 3;

  const triageRules = readAgentFile("maintenance_agent/skills/triage_request.md");

  const prompt = `${systemContext}

---

${triageRules}

---

Task: Classify this maintenance report. UK context. Heating season (Nov–Mar): ${heatingSeason ? "yes" : "no"}.

Title: ${title}
Description: ${description}
Tenant priority field: ${priority}

Return ONLY valid JSON:
{
  "category": "urgent-safety" | "urgent" | "routine" | "low-priority",
  "responseTime": "short UK English phrase",
  "recommendedAction": "one line for landlord",
  "summary": "one line, max ~120 chars"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch
      ? (JSON.parse(jsonMatch[0]) as {
          category?: string;
          responseTime?: string;
          recommendedAction?: string;
          summary?: string;
        })
      : {};

    const category = normalizeCategory(parsed.category);
    return {
      category,
      responseTime: (parsed.responseTime ?? "Within 7 days").trim(),
      recommendedAction: (parsed.recommendedAction ?? "Review and arrange follow-up").trim(),
      summary: (parsed.summary ?? description).trim().slice(0, 200),
    };
  } catch {
    return fallbackTriage(description);
  }
}

function buildTenantAckEmail(args: {
  tenantName: string;
  maintenanceRequestId: string;
  summary: string;
  responseTime: string;
  landlordContact: string;
  category: TriageCategory;
}): { subject: string; body: string } {
  const reference = refShort(args.maintenanceRequestId);
  const subject = `Maintenance request received — ref ${reference}`;
  const safetyBlock =
    args.category === "urgent-safety"
      ? `If you are in immediate danger, contact the emergency services (999). For urgent gas concerns, contact the Gas Emergency Service on **0800 111 999**.\n\n`
      : "";
  const body = `Dear ${args.tenantName},

Thank you for reporting an issue at your property. We have logged your maintenance request.

**Reference:** ${reference}

**Summary:** ${args.summary}

We aim to respond within **${args.responseTime}**. Your landlord or property manager will be in touch about next steps. We have not scheduled a repair visit yet — we will contact you once arrangements are confirmed.

${safetyBlock}For general queries, you can reach your landlord via: ${args.landlordContact}

Kind regards,

Letora (on behalf of your landlord)`;
  return { subject, body };
}

function buildLandlordSummaryEmail(args: {
  propertyAddress: string;
  tenantName: string;
  issueDescription: string;
  triage: TriageResult;
}): { subject: string; body: string } {
  const c = args.triage.category;
  const indicator = colourIndicator(c);
  const subject = `Maintenance — ${args.propertyAddress} — ${c}`;
  const safety =
    c === "urgent-safety"
      ? `**Safety:** This is flagged as urgent-safety. Seek a **qualified professional contractor** immediately; do not attempt DIY repairs for gas, electrics, or structural work unless you are competent and insured.\n\n`
      : "";
  const body = `**Property:** ${args.propertyAddress}
**Tenant:** ${args.tenantName}

**Issue (tenant report):**
${args.issueDescription}

---

**AI triage**

- **Category:** ${c} ${indicator}
- **Summary:** ${args.triage.summary}
- **Expected response:** ${args.triage.responseTime}
- **Recommended action:** ${args.triage.recommendedAction}

${safety}---

This message was generated by the Letora maintenance assistant. Review drafts before sending if auto-send is off.`;
  return { subject, body };
}

function emailStatusFromSend(
  r: Awaited<ReturnType<typeof sendEmailTool>>,
): "sent" | "draft" | "failed" {
  if (r.sent) return "sent";
  if (r.error && !r.emailLogId) return "failed";
  return "draft";
}

export type RunMaintenanceAgentOptions = {
  /** Used when `user_settings.contact_email` is empty (e.g. landlord session email). */
  landlordEmailFallback?: string | null;
};

export async function runMaintenanceAgent(
  maintenanceRequestId: string,
  userId: string,
  supabaseClient?: SupabaseClient,
  options?: RunMaintenanceAgentOptions,
): Promise<MaintenanceAgentResult> {
  const supabase = supabaseClient ?? (await createClient());

  let stepCount = 0;
  function nextStep() {
    stepCount += 1;
    assertStepBudget(stepCount, OTA_MAX);
    return stepCount;
  }

  /** Property + tenant come from `tenancy_id` → `tenancies`; landlord ownership via `properties.user_id`. */
  const { data: row, error: fetchError } = await supabase
    .from("maintenance_requests")
    .select(
      `
      *,
      tenancies!inner (
        property_id,
        tenant_id,
        properties!inner ( id, user_id, address ),
        tenant_profiles ( id, full_name, email )
      )
    `,
    )
    .eq("id", maintenanceRequestId)
    .maybeSingle();

  if (fetchError || !row) {
    return {
      success: false,
      agentRunId: null,
      triageCategory: null,
      tenantEmailStatus: "failed",
      landlordEmailStatus: "failed",
      message: fetchError?.message ?? "Maintenance request not found",
    };
  }

  const tenancyRaw = row.tenancies as unknown;
  const tenancy = (Array.isArray(tenancyRaw) ? tenancyRaw[0] : tenancyRaw) as {
    property_id: string | null;
    tenant_id: string | null;
    properties: unknown;
    tenant_profiles: unknown;
  } | null;

  const propRaw = tenancy?.properties;
  const property = (Array.isArray(propRaw) ? propRaw[0] : propRaw) as {
    user_id: string;
    address: string | null;
  } | null;
  const tenRaw = tenancy?.tenant_profiles;
  const tenant = (Array.isArray(tenRaw) ? tenRaw[0] : tenRaw) as {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email: string | null;
  } | null;

  if (!property || property.user_id !== userId) {
    return {
      success: false,
      agentRunId: null,
      triageCategory: null,
      tenantEmailStatus: "failed",
      landlordEmailStatus: "failed",
      message: "Forbidden",
    };
  }

  if (!tenant?.email?.trim()) {
    return {
      success: false,
      agentRunId: null,
      triageCategory: null,
      tenantEmailStatus: "failed",
      landlordEmailStatus: "failed",
      message: "Tenant has no email address",
    };
  }

  const storedDescription = (row.description as string) ?? "";
  const { issueTitle, issueBody } = splitStoredMaintenanceDescription(storedDescription);
  const title = issueTitle || storedDescription.slice(0, 100);
  const description = issueBody || storedDescription;
  const priority = (row.priority as string) ?? "medium";
  const tenantName =
    tenant.full_name?.trim() ||
    [tenant.first_name, tenant.last_name].filter(Boolean).join(" ").trim() ||
    "Tenant";
  const tenantEmail = tenant.email.trim();
  const propertyAddress =
    normalizePropertyAddressLabel(property.address?.trim() ?? "") || "the property";

  await recordAgentRunStep(supabase, {
    userId,
    agentRunId: null,
    stepIndex: nextStep(),
    stepType: "observe",
    toolName: "fetch_maintenance_context",
    detail: {
      maintenanceRequestId,
      propertyAddress,
      tenantEmail,
    },
  });

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      agentRunId: null,
      triageCategory: null,
      tenantEmailStatus: "failed",
      landlordEmailStatus: "failed",
      message: "Missing GOOGLE_AI_API_KEY",
    };
  }

  let systemContext = "";
  try {
    systemContext = await loadAgentContext(supabase, "maintenance_agent", userId);
  } catch (e) {
    console.warn("[MaintenanceAgent] loadAgentContext", e);
    systemContext = "UK letting agent maintenance assistant.";
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const triage = await generateTriage(model, systemContext, title, description, priority);

  await recordAgentRunStep(supabase, {
    userId,
    agentRunId: null,
    stepIndex: nextStep(),
    stepType: "think",
    toolName: "gemini_triage",
    detail: { triage },
  });

  const { data: settings } = await supabase
    .from("user_settings")
    .select("landlord_name, contact_email, contact_phone, business_name")
    .eq("user_id", userId)
    .maybeSingle();

  const landlordContact =
    [settings?.contact_email?.trim(), settings?.contact_phone?.trim()].filter(Boolean).join(" · ") ||
    "your landlord (see your tenancy documents)";

  const landlordEmailTo =
    settings?.contact_email?.trim() || options?.landlordEmailFallback?.trim() || "";

  const { data: insertedRun, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      user_id: userId,
      agent_type: "maintenance",
      status: "draft",
      payload: {
        maintenanceRequestId,
        triage,
        propertyAddress,
        tenantName,
      },
    })
    .select("id")
    .single();

  if (runError || !insertedRun) {
    return {
      success: false,
      agentRunId: null,
      triageCategory: triage.category,
      tenantEmailStatus: "failed",
      landlordEmailStatus: "failed",
      message: runError?.message ?? "Failed to create agent run",
    };
  }

  const agentRunId = insertedRun.id as string;

  const { error: triageUpdateError } = await supabase
    .from("maintenance_requests")
    .update({
      ai_triage_category: triage.category,
      ai_triage_summary: triage.summary,
    })
    .eq("id", maintenanceRequestId);

  if (triageUpdateError) {
    await supabase.from("agent_runs").delete().eq("id", agentRunId).eq("user_id", userId);
    return {
      success: false,
      agentRunId: null,
      triageCategory: triage.category,
      tenantEmailStatus: "failed",
      landlordEmailStatus: "failed",
      message: triageUpdateError.message,
    };
  }

  const tenantMail = buildTenantAckEmail({
    tenantName,
    maintenanceRequestId,
    summary: triage.summary,
    responseTime: triage.responseTime,
    landlordContact,
    category: triage.category,
  });

  const tenantSend = await sendEmailTool(supabase, userId, agentRunId, {
    to: tenantEmail,
    toName: tenantName,
    subject: tenantMail.subject,
    body: tenantMail.body,
    agentType: "maintenance",
  });

  const landlordMail = buildLandlordSummaryEmail({
    propertyAddress,
    tenantName,
    issueDescription: description,
    triage,
  });

  let landlordSend: Awaited<ReturnType<typeof sendEmailTool>> = {
    sent: false,
    emailLogId: "",
    message: "Skipped — no landlord email in settings",
  };
  if (landlordEmailTo) {
    landlordSend = await sendEmailTool(supabase, userId, agentRunId, {
      to: landlordEmailTo,
      toName: settings?.landlord_name?.trim() || settings?.business_name?.trim() || "Landlord",
      subject: landlordMail.subject,
      body: landlordMail.body,
      agentType: "maintenance",
    });
  }

  const now = new Date().toISOString();

  if (triage.category === "urgent-safety") {
    await supabase.from("agent_runs").insert({
      user_id: userId,
      agent_type: "safety_alert",
      status: "completed",
      payload: {
        type: "safety_alert",
        maintenanceRequestId,
        propertyAddress,
        issueSummary: triage.summary,
        triageCategory: triage.category,
        createdAt: now,
      },
    });
  }

  await supabase
    .from("maintenance_requests")
    .update({
      tenant_acknowledged_at: tenantSend.emailLogId ? now : null,
      landlord_notified_at: landlordSend.emailLogId ? now : null,
    })
    .eq("id", maintenanceRequestId);

  const tenantEmailStatus = emailStatusFromSend(tenantSend);
  const landlordEmailStatus = landlordEmailTo ? emailStatusFromSend(landlordSend) : "failed";

  await recordAgentRunStep(supabase, {
    userId,
    agentRunId,
    stepIndex: nextStep(),
    stepType: "act",
    toolName: "send_maintenance_emails",
    detail: {
      tenantEmailLogId: tenantSend.emailLogId,
      tenantSent: tenantSend.sent,
      landlordEmailLogId: landlordSend.emailLogId,
      landlordSent: landlordSend.sent,
      safetyAlert: triage.category === "urgent-safety",
    },
  });

  await supabase
    .from("agent_runs")
    .update({
      status: "completed",
      payload: {
        maintenanceRequestId,
        triage,
        propertyAddress,
        tenantName,
        tenantEmailStatus,
        landlordEmailStatus,
        messages: {
          tenant: tenantSend.message,
          landlord: landlordSend.message,
        },
      },
    })
    .eq("id", agentRunId)
    .eq("user_id", userId);

  await recordAgentRunStep(supabase, {
    userId,
    agentRunId,
    stepIndex: nextStep(),
    stepType: "complete",
    toolName: "complete",
    detail: { agentRunId, triageCategory: triage.category },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/maintenance");
  revalidatePath(`/dashboard/maintenance/${maintenanceRequestId}`);

  return {
    success: true,
    agentRunId,
    triageCategory: triage.category,
    tenantEmailStatus,
    landlordEmailStatus,
    message: `${tenantSend.message}; ${landlordSend.message}`,
  };
}
