import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAgentRunStep } from "@/lib/agents/audit";
import { loadAgentContext } from "@/lib/agents/context-loader";
import { assertStepBudget } from "@/lib/agents/ota-loop";
import { readAgentFile } from "@/lib/agents/paths";
import { sendEmailTool } from "@/lib/tools/send-email";
import { createClient } from "@/lib/supabase/server";

const OTA_MAX = 5;

export type TenantOnboardingResult = {
  success: boolean;
  agentRunId: string | null;
  tasksCreated: number;
  emailStatus: "sent" | "draft" | "failed";
  message?: string;
};

type TenancyContext = {
  tenancyId: string;
  userId: string;
  propertyId: string;
  tenantId: string;
  moveInDate: string;
  tenantEmail: string;
  tenantName: string;
  propertyAddress: string;
  landlordName: string;
  landlordContact: string;
  monthlyRent: number;
  depositAmount: number | null;
};

function formatUkDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function addDaysIso(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function fillWelcomeTemplate(template: string, ctx: TenancyContext): string {
  return template
    .replace(/\{\{tenant\.name\}\}/g, ctx.tenantName)
    .replace(/\{\{property\.address\}\}/g, ctx.propertyAddress)
    .replace(/\{\{moveInDate\}\}/g, formatUkDate(ctx.moveInDate))
    .replace(/\{\{landlord\.name\}\}/g, ctx.landlordName)
    .replace(/\{\{landlord\.contact\}\}/g, ctx.landlordContact);
}

function buildWelcomeEmail(ctx: TenancyContext): { subject: string; body: string } {
  const raw = readAgentFile("tenant_onboarding/skills/send_welcome_email.md");
  const subjectLine =
    raw.match(/## Subject line[^\n]*\n+\s*([^\n]+)/)?.[1]?.trim() ??
    "Welcome to your new home — {{property.address}}";
  const bodyStart = raw.indexOf("## Body template");
  const bodySection = bodyStart >= 0 ? raw.slice(bodyStart) : raw;
  const lines = bodySection.split("\n");
  const bodyLines: string[] = [];
  let inBody = false;
  for (const line of lines) {
    if (line.startsWith("## Body template")) {
      inBody = true;
      continue;
    }
    if (inBody && line.startsWith("## ")) break;
    if (inBody) bodyLines.push(line);
  }
  let body = bodyLines.join("\n").trim();
  if (!body) {
    body = "Welcome — we’re pleased to confirm your tenancy.";
  }
  const subject = fillWelcomeTemplate(subjectLine, ctx);
  return {
    subject,
    body: fillWelcomeTemplate(body, ctx),
  };
}

export async function runTenantOnboardingAgent(
  tenancyId: string,
  userId: string,
  supabaseClient?: SupabaseClient,
): Promise<TenantOnboardingResult> {
  const supabase = supabaseClient ?? (await createClient());

  let stepCount = 0;
  function nextStep() {
    stepCount += 1;
    assertStepBudget(stepCount, OTA_MAX);
    return stepCount;
  }

  const { data: row, error: fetchError } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      property_id,
      tenant_id,
      start_date,
      move_in_date,
      monthly_rent,
      deposit_amount,
      onboarding_status,
      properties!inner ( user_id, address, city, postcode ),
      tenant_profiles ( full_name, email, phone )
    `,
    )
    .eq("id", tenancyId)
    .maybeSingle();

  if (fetchError || !row) {
    return {
      success: false,
      agentRunId: null,
      tasksCreated: 0,
      emailStatus: "failed",
      message: fetchError?.message ?? "Tenancy not found",
    };
  }

  const propRaw = row.properties as unknown;
  const property = (Array.isArray(propRaw) ? propRaw[0] : propRaw) as {
    user_id: string;
    address: string | null;
    city: string | null;
    postcode: string | null;
  };
  const tenRaw = row.tenant_profiles as unknown;
  const tenant = (Array.isArray(tenRaw) ? tenRaw[0] : tenRaw) as {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;

  if (!property || !tenant) {
    return {
      success: false,
      agentRunId: null,
      tasksCreated: 0,
      emailStatus: "failed",
      message: "Missing property or tenant data",
    };
  }

  if (property.user_id !== userId) {
    return {
      success: false,
      agentRunId: null,
      tasksCreated: 0,
      emailStatus: "failed",
      message: "Forbidden",
    };
  }

  const onboardingStatus = (row as { onboarding_status?: string }).onboarding_status ?? "not_started";
  if (onboardingStatus !== "not_started") {
    return {
      success: false,
      agentRunId: null,
      tasksCreated: 0,
      emailStatus: "failed",
      message: "Onboarding already started or completed for this tenancy",
    };
  }

  const startDateIso = row.start_date ?? new Date().toISOString().slice(0, 10);
  const moveInExplicit = (row as { move_in_date?: string | null }).move_in_date;
  const moveInDate =
    (typeof moveInExplicit === "string" && moveInExplicit.trim() !== ""
      ? moveInExplicit.trim()
      : null) ?? startDateIso;
  const addressParts = [property.address, property.city, property.postcode].filter(Boolean);
  const propertyAddress = addressParts.join(", ") || "the property";

  const { data: settings } = await supabase
    .from("user_settings")
    .select("landlord_name, contact_email, contact_phone, business_name")
    .eq("user_id", userId)
    .maybeSingle();

  const landlordName =
    settings?.landlord_name?.trim() ||
    settings?.business_name?.trim() ||
    "Your landlord";
  const landlordContact =
    [settings?.contact_email?.trim(), settings?.contact_phone?.trim()].filter(Boolean).join(" · ") ||
    "see your welcome pack";

  const tenantName = tenant.full_name?.trim() || "Tenant";
  const tenantEmail = tenant.email?.trim() || "";
  if (!tenantEmail) {
    return {
      success: false,
      agentRunId: null,
      tasksCreated: 0,
      emailStatus: "failed",
      message: "Tenant has no email address",
    };
  }

  const ctx: TenancyContext = {
    tenancyId,
    userId,
    propertyId: row.property_id as string,
    tenantId: row.tenant_id as string,
    moveInDate,
    tenantEmail,
    tenantName,
    propertyAddress,
    landlordName,
    landlordContact,
    monthlyRent:
      row.monthly_rent == null
        ? 0
        : typeof row.monthly_rent === "number"
          ? row.monthly_rent
          : Number(row.monthly_rent),
    depositAmount:
      row.deposit_amount == null
        ? null
        : typeof row.deposit_amount === "number"
          ? row.deposit_amount
          : Number(row.deposit_amount),
  };

  await recordAgentRunStep(supabase, {
    userId,
    agentRunId: null,
    stepIndex: nextStep(),
    stepType: "observe",
    toolName: "fetch_tenancy_details",
    detail: { tenancyId, moveInDate, tenantEmail },
  });

  let systemContext = "";
  try {
    systemContext = await loadAgentContext(supabase, "tenant_onboarding", userId);
  } catch (e) {
    console.warn("[TenantOnboarding] loadAgentContext", e);
    systemContext = "UK letting agent onboarding assistant.";
  }

  await recordAgentRunStep(supabase, {
    userId,
    agentRunId: null,
    stepIndex: nextStep(),
    stepType: "think",
    toolName: "load_agent_context",
    detail: { chars: systemContext.length },
  });

  const { subject, body } = buildWelcomeEmail(ctx);

  const payload = {
    tenancyId,
    tenantName,
    propertyAddress,
    moveInDate,
    subject,
    monthlyRent: ctx.monthlyRent,
    depositAmount: ctx.depositAmount,
  };

  const { data: insertedRun, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      user_id: userId,
      agent_type: "tenant_onboarding",
      status: "draft",
      payload,
    })
    .select("id")
    .single();

  if (runError || !insertedRun) {
    return {
      success: false,
      agentRunId: null,
      tasksCreated: 0,
      emailStatus: "failed",
      message: runError?.message ?? "Failed to create agent run",
    };
  }

  const agentRunId = insertedRun.id as string;

  const sendResult = await sendEmailTool(supabase, userId, agentRunId, {
    to: ctx.tenantEmail,
    toName: ctx.tenantName,
    subject,
    body,
    agentType: "onboarding",
  });

  const emailStatus: TenantOnboardingResult["emailStatus"] = sendResult.sent
    ? "sent"
    : sendResult.error && !sendResult.emailLogId
      ? "failed"
      : "draft";

  const refDue = addDaysIso(moveInDate, -14);
  const moveInEmailDue = addDaysIso(moveInDate, -3);

  const welcomeCompletedAt = sendResult.sent ? new Date().toISOString() : null;

  const taskRows: Array<{
    tenancy_id: string;
    user_id: string;
    task_name: string;
    task_type: string;
    status: string;
    email_log_id: string | null;
    due_date: string | null;
    completed_at: string | null;
  }> = [
    {
      tenancy_id: tenancyId,
      user_id: userId,
      task_name: "Welcome email",
      task_type: "email",
      status: sendResult.sent ? "complete" : "pending",
      email_log_id: sendResult.emailLogId || null,
      due_date: null,
      completed_at: welcomeCompletedAt,
    },
    {
      tenancy_id: tenancyId,
      user_id: userId,
      task_name: "Photo ID verification",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: refDue,
      completed_at: null,
    },
    {
      tenancy_id: tenancyId,
      user_id: userId,
      task_name: "Right to Rent document check",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: refDue,
      completed_at: null,
    },
    {
      tenancy_id: tenancyId,
      user_id: userId,
      task_name: "Employment reference request",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: refDue,
      completed_at: null,
    },
    {
      tenancy_id: tenancyId,
      user_id: userId,
      task_name: "Previous landlord reference",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: refDue,
      completed_at: null,
    },
    {
      tenancy_id: tenancyId,
      user_id: userId,
      task_name: "Credit check",
      task_type: "check",
      status: "pending",
      email_log_id: null,
      due_date: refDue,
      completed_at: null,
    },
    {
      tenancy_id: tenancyId,
      user_id: userId,
      task_name: "Send move-in instructions email",
      task_type: "email",
      status: "pending",
      email_log_id: null,
      due_date: moveInEmailDue,
      completed_at: null,
    },
    {
      tenancy_id: tenancyId,
      user_id: userId,
      task_name: "Prepare tenancy agreement (contract not sent by agent)",
      task_type: "manual",
      status: "pending",
      email_log_id: null,
      due_date: null,
      completed_at: null,
    },
  ];

  const { error: tasksError } = await supabase.from("onboarding_tasks").insert(taskRows);

  if (tasksError) {
    return {
      success: false,
      agentRunId,
      tasksCreated: 0,
      emailStatus,
      message: tasksError.message,
    };
  }

  const { error: tenancyError } = await supabase
    .from("tenancies")
    .update({ onboarding_status: "in_progress" })
    .eq("id", tenancyId);

  if (tenancyError) {
    return {
      success: false,
      agentRunId,
      tasksCreated: taskRows.length,
      emailStatus,
      message: tenancyError.message,
    };
  }

  await supabase
    .from("agent_runs")
    .update({
      status: "completed",
      payload: {
        ...payload,
        emailLogId: sendResult.emailLogId,
        sent: sendResult.sent,
        tasksCreated: taskRows.length,
      },
    })
    .eq("id", agentRunId)
    .eq("user_id", userId);

  await recordAgentRunStep(supabase, {
    userId,
    agentRunId,
    stepIndex: nextStep(),
    stepType: "act",
    toolName: "onboarding_run",
    detail: {
      emailLogId: sendResult.emailLogId,
      sent: sendResult.sent,
      tasksCreated: taskRows.length,
      message: sendResult.message,
    },
  });

  await recordAgentRunStep(supabase, {
    userId,
    agentRunId,
    stepIndex: nextStep(),
    stepType: "act",
    toolName: "complete",
    detail: { agentRunId },
  });

  return {
    success: true,
    agentRunId,
    tasksCreated: taskRows.length,
    emailStatus,
    message: sendResult.message,
  };
}
