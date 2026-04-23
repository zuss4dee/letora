import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAgentApproval } from "@/lib/actions/agent-approvals";
import { recordAgentRunStep } from "@/lib/agents/audit";
import { loadAgentContext } from "@/lib/agents/context-loader";
import { assertStepBudget } from "@/lib/agents/ota-loop";
import type { CreateAgentApprovalContract, SendRentChaseEmailEvidence } from "@/lib/approvals/types";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";

export interface AgentResult {
  tenantName: string;
  tenantEmail: string;
  propertyAddress: string;
  amountOwed: number;
  daysOverdue: number;
  emailSubject: string;
  emailBody: string;
  actionId: string;
  emailSent?: boolean;
}

type PaymentRow = {
  id: string;
  property_id: string | null;
  tenant_id: string | null;
  due_date: string | null;
  amount: number | string | null;
  status: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function getDaysOverdue(dueDateIso: string | null) {
  if (!dueDateIso) return 0;
  const due = new Date(`${dueDateIso}T00:00:00.000Z`);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor(diffMs / oneDayMs));
}

async function generateEmailDraft(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  systemContext: string,
  tenantName: string,
  propertyAddress: string,
  amountOwed: number,
  daysOverdue: number,
  settings: {
    businessName: string;
    landlordName: string;
    tone: string;
    signoff: string;
    includePaymentPlan: boolean;
    instructions: string;
  },
) {
  const prompt = `${systemContext}

---

Task: Write a rent chase email for the following facts.
Tenant name: ${tenantName}
Property address: ${propertyAddress}
Amount owed: £${amountOwed}
Days overdue: ${daysOverdue}
Business name: ${settings.businessName}
Landlord name: ${settings.landlordName}
Communication tone: ${settings.tone}
Preferred sign-off: ${settings.signoff}
Include payment plan offer: ${settings.includePaymentPlan ? "Yes" : "No"}
Custom instructions: ${settings.instructions || "None"}

Return ONLY valid JSON in this exact format:
{
  "subject": "email subject line here",
  "body": "full email body here"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as { subject?: string; body?: string }) : {};

  return {
    subject: parsed.subject?.trim() || "Outstanding rent payment reminder",
    body:
      parsed.body?.trim() ||
      "Please contact us regarding your outstanding rent payment as soon as possible.",
  };
}

export type RunRentChaserOptions = {
  supabase?: SupabaseClient;
  /** If set, only chase payments whose due date falls in this calendar month (YYYY-MM). */
  month?: string;
  /** Traced in agent run payload for audit (e.g. `ceo_assistant`). */
  source?: string;
  /** If set (e.g. CEO tool when the user named a tenant), only that tenant’s chaseable rows. */
  tenantId?: string;
};

export async function runRentChaserAgent(userId: string, options?: RunRentChaserOptions): Promise<AgentResult[]> {
  const monthFilter = options?.month?.trim();
  const sourceTag = options?.source?.trim() || "rent_chaser_agent";
  const supabase = options?.supabase ?? (await createClient());
  let sessionUserEmail: string | undefined;
  if (!options?.supabase) {
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    sessionUserEmail = sessionUser?.email ?? undefined;
  }
  const resolvedUserId = userId;
  if (!resolvedUserId) return [];

  let stepCount = 0;
  function nextStep() {
    stepCount += 1;
    assertStepBudget(stepCount);
    return stepCount;
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const today = new Date().toISOString().split("T")[0];

  let systemContext = "";
  try {
    systemContext = await loadAgentContext(supabase, "rent_chaser", resolvedUserId);
  } catch (e) {
    console.error("[RentChaser] loadAgentContext failed", e);
    systemContext =
      "You are a professional UK letting agent. Follow user settings and UK English. Output JSON with subject and body.";
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select(
      "business_name,landlord_name,contact_email,rent_chaser_tone,email_signoff,include_payment_plan,rent_chaser_instructions",
    )
    .eq("user_id", resolvedUserId)
    .maybeSingle<{
      business_name: string | null;
      landlord_name: string | null;
      contact_email: string | null;
      rent_chaser_tone: string | null;
      email_signoff: string | null;
      include_payment_plan: boolean | null;
      rent_chaser_instructions: string | null;
    }>();

  const landlordFallbackEmail = settings?.contact_email?.trim() || sessionUserEmail?.trim() || "";

  const promptSettings = {
    businessName: settings?.business_name ?? "Letora Property Management",
    landlordName: settings?.landlord_name ?? "Landlord",
    tone: settings?.rent_chaser_tone ?? "professional_firm",
    signoff: settings?.email_signoff ?? "Kind regards",
    includePaymentPlan: settings?.include_payment_plan ?? true,
    instructions: settings?.rent_chaser_instructions ?? "",
  };

  const { data: overdueData, error: overdueError } = await supabase
    .from("rent_payments")
    .select("id,property_id,tenant_id,amount,due_date,status")
    .eq("user_id", resolvedUserId)
    .eq("status", "overdue");

  const { data: pendingData, error: pendingError } = await supabase
    .from("rent_payments")
    .select("id,property_id,tenant_id,amount,due_date,status")
    .eq("user_id", resolvedUserId)
    .eq("status", "pending")
    .lt("due_date", today);

  if (overdueError || pendingError) {
    return [];
  }

  const merged = [...(overdueData ?? []), ...(pendingData ?? [])] as PaymentRow[];
  const seenIds = new Set<string>();
  let candidates = merged.filter((row) => {
    if (seenIds.has(row.id)) return false;
    seenIds.add(row.id);
    return true;
  });

  if (monthFilter && /^\d{4}-\d{2}$/.test(monthFilter)) {
    const start = `${monthFilter}-01`;
    const end = `${monthFilter}-31`;
    candidates = candidates.filter((row) => {
      const d = row.due_date;
      if (!d) return false;
      return d >= start && d <= end;
    });
  }

  const scopedTenantId = options?.tenantId?.trim();
  if (scopedTenantId) {
    candidates = candidates.filter((row) => row.tenant_id === scopedTenantId);
  }

  await recordAgentRunStep(supabase, {
    userId: resolvedUserId,
    agentRunId: null,
    stepIndex: nextStep(),
    stepType: "observe",
    toolName: "list_chaseable_payments",
    detail: {
      overdue: overdueData?.length ?? 0,
      pendingPastDue: pendingData?.length ?? 0,
      merged: candidates.length,
      monthFilter: monthFilter ?? null,
      source: sourceTag,
      tenantIdFilter: scopedTenantId ?? null,
    },
  });

  const propertyIds = candidates
    .map((row) => row.property_id)
    .filter((id): id is string => Boolean(id));
  const tenantIds = candidates
    .map((row) => row.tenant_id)
    .filter((id): id is string => Boolean(id));

  const [{ data: properties }, { data: tenants }] = await Promise.all([
    supabase
      .from("properties")
      .select("id,address")
      .in("id", propertyIds.length ? propertyIds : ["none"]),
    supabase
      .from("tenants")
      .select("id,full_name,email")
      .in("id", tenantIds.length ? tenantIds : ["none"]),
  ]);

  const filtered = candidates
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .map((row) => {
      const property = properties?.find((p) => p.id === row.property_id);
      const tenant = tenants?.find((t) => t.id === row.tenant_id);
      return { row, property, tenant };
    });

  if (filtered.length === 0) return [];

  const results: AgentResult[] = [];

  for (const entry of filtered) {
    const { row, property, tenant } = entry;
    const tenantName = tenant?.full_name ?? "Unknown tenant";
    const tenantEmail = tenant?.email?.trim() || landlordFallbackEmail;
    const propertyAddress =
      normalizePropertyAddressLabel(property?.address ?? "") || "Unknown property";
    const amountOwed = Math.max(0, toNumber(row.amount));
    const daysOverdue = getDaysOverdue(row.due_date);

    await recordAgentRunStep(supabase, {
      userId: resolvedUserId,
      agentRunId: null,
      stepIndex: nextStep(),
      stepType: "think",
      toolName: "draft_chase_email",
      detail: { rentPaymentId: row.id, tenantName, propertyAddress },
    });

    const draft = await generateEmailDraft(
      model,
      systemContext,
      tenantName,
      propertyAddress,
      amountOwed,
      daysOverdue,
      promptSettings,
    );

    const payload = {
      rentPaymentId: row.id,
      tenantName,
      tenantEmail,
      propertyAddress,
      amountOwed,
      daysOverdue,
      emailSubject: draft.subject,
      emailBody: draft.body,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("agent_runs")
      .insert({
        user_id: resolvedUserId,
        agent_type: "rent_chaser",
        status: "draft",
        payload: { ...payload, source: sourceTag },
      })
      .select("id")
      .single();

    if (insertError || !inserted) continue;

    await recordAgentRunStep(supabase, {
      userId: resolvedUserId,
      agentRunId: inserted.id,
      stepIndex: nextStep(),
      stepType: "act",
      toolName: "save_agent_run",
      detail: { rentPaymentId: row.id, agentRunId: inserted.id },
    });

    let emailSent = false;
    let approvalId: string | null = null;

    if (tenantEmail.trim()) {
      const dueDateLabel = row.due_date ?? "—";
      const evidence: SendRentChaseEmailEvidence = {
        tenantName,
        tenantId: row.tenant_id,
        propertyId: row.property_id,
        propertyAddress,
        amountOwed,
        daysOverdue,
        dueDate: row.due_date,
        emailSubject: draft.subject,
        bodyPreview: draft.body.length > 280 ? `${draft.body.slice(0, 277)}…` : draft.body,
      };

      const approval = await createAgentApproval(
        {
          agentRunId: inserted.id,
          agentType: "rent_chaser",
          title: `Approve rent chase — ${tenantName}`,
          summary: `£${amountOwed.toFixed(2)} owed · ${daysOverdue}d overdue · due ${dueDateLabel}`,
          actionType: "send_rent_chase_email",
          targetType: "rent_payment",
          targetId: row.id,
          payload: {
            userId: resolvedUserId,
            rentPaymentId: row.id,
            tenantId: row.tenant_id,
            propertyId: row.property_id,
            tenantEmail,
            tenantName,
            emailSubject: draft.subject,
            emailBody: draft.body,
            amountOwed,
            daysOverdue,
            dueDate: row.due_date,
          },
          evidence,
        } satisfies CreateAgentApprovalContract,
        { supabase, userId: resolvedUserId },
      );

      if (!approval.ok) {
        await supabase
          .from("agent_runs")
          .update({
            status: "failed",
            payload: { ...payload, source: sourceTag, approvalError: approval.error },
          })
          .eq("id", inserted.id)
          .eq("user_id", resolvedUserId);
        continue;
      }

      approvalId = approval.id;

      await recordAgentRunStep(supabase, {
        userId: resolvedUserId,
        agentRunId: inserted.id,
        stepIndex: nextStep(),
        stepType: "act",
        toolName: "request_rent_chase_approval",
        detail: {
          rentPaymentId: row.id,
          approvalId,
        },
      });
    } else {
      await recordAgentRunStep(supabase, {
        userId: resolvedUserId,
        agentRunId: inserted.id,
        stepIndex: nextStep(),
        stepType: "act",
        toolName: "send_email_tool",
        detail: { skipped: true, reason: "No recipient email" },
      });
    }

    if ((row.status ?? "").toLowerCase() === "pending") {
      await supabase
        .from("rent_payments")
        .update({ status: "overdue" })
        .eq("id", row.id)
        .eq("user_id", resolvedUserId);
    }

    const awaitingApproval = Boolean(tenantEmail.trim() && approvalId);
    await supabase
      .from("agent_runs")
      .update({
        status: awaitingApproval ? "pending" : "completed",
        payload: {
          ...payload,
          source: sourceTag,
          approvalId,
          approvalRequiredForRentChase: tenantEmail.trim() ? true : false,
          emailSent,
        },
      })
      .eq("id", inserted.id)
      .eq("user_id", resolvedUserId);

    results.push({
      tenantName,
      tenantEmail,
      propertyAddress,
      amountOwed,
      daysOverdue,
      emailSubject: draft.subject,
      emailBody: draft.body,
      actionId: inserted.id,
      emailSent,
    });
  }

  return results;
}
