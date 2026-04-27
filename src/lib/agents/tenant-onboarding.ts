import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAgentRunStep } from "@/lib/agents/audit";
import { loadAgentContext } from "@/lib/agents/context-loader";
import { assertStepBudget } from "@/lib/agents/ota-loop";
import { createAgentApproval } from "@/lib/actions/agent-approvals";
import type { CreateAgentApprovalContract, SendOnboardingEmailEvidence } from "@/lib/approvals/types";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { sendEmailTool } from "@/lib/tools/send-email";
import { createClient } from "@/lib/supabase/server";

const OTA_MAX = 5;
const REQUIRE_APPROVAL_FOR_WELCOME_EMAIL = true;

/** Optional traceability for a single onboarding execution (e.g. internal auto-onboard). */
export type RunTenantOnboardingAgentOptions = {
  runCorrelationId?: string;
};

export type TenantOnboardingResult = {
  success: boolean;
  agentRunId: string | null;
  tasksCreated: number;
  emailStatus: "sent" | "draft" | "failed" | "skipped";
  message?: string;
  /** Present when onboarding was already started — CEO should use tasks, not restart the agent. */
  mode?: "resume";
  tenancy_id?: string;
  tenant_name?: string;
  property_address?: string;
  onboarding_status?: string;
  referencing_complete?: boolean;
  tasks?: Array<{ task_name: string; status: string }>;
  tasks_complete?: number;
  tasks_total?: number;
  pending_task_names?: string[];
  ceo_resume_hint?: string;
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

async function buildWelcomeEmail(ctx: TenancyContext): Promise<{ subject: string; body: string; html?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://letora.co";
  const onboardingUrl = `${baseUrl}/dashboard/tenancies/${ctx.tenancyId}`;

  const { renderWelcomeEmail } = await import("@/components/email/templates/registry");
  const rendered = await renderWelcomeEmail({
    tenantName: ctx.tenantName,
    propertyAddress: ctx.propertyAddress,
    onboardingUrl,
    startDate: formatUkDate(ctx.moveInDate),
  });

  return {
    subject: rendered.subject,
    body: rendered.text,
    html: rendered.html,
  };
}

/** If a welcome email was actually sent (email_logs) but the task row stayed pending, mark it complete. */
async function syncWelcomeEmailTaskIfSent(
  supabase: SupabaseClient,
  tenancyId: string,
  userId: string,
  tenantEmail: string | null,
  sinceIso: string,
): Promise<void> {
  const email = tenantEmail?.trim();
  if (!email) return;

  const { data: pendingWelcome } = await supabase
    .from("onboarding_tasks")
    .select("id")
    .eq("tenancy_id", tenancyId)
    .eq("user_id", userId)
    .eq("task_name", "Welcome email")
    .eq("status", "pending")
    .maybeSingle();

  if (!pendingWelcome) return;

  const { data: sent } = await supabase
    .from("email_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_type", "onboarding")
    .eq("status", "sent")
    .ilike("to_email", email)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!sent?.id) return;

  const now = new Date().toISOString();
  await supabase
    .from("onboarding_tasks")
    .update({
      status: "complete",
      completed_at: now,
      email_log_id: sent.id,
    })
    .eq("tenancy_id", tenancyId)
    .eq("user_id", userId)
    .eq("task_name", "Welcome email")
    .eq("status", "pending");
}

/**
 * Live onboarding checklist + referencing flags for CEO tools (resume, navigation).
 * Syncs welcome-email task from email_logs when appropriate so dashboard ticks match chat.
 */
export async function getOnboardingChatSnapshotForTenancy(
  supabase: SupabaseClient,
  userId: string,
  tenancyId: string,
): Promise<{
  onboarding_status: string;
  referencing_complete: boolean;
  tasks: Array<{ task_name: string; status: string }>;
  tasks_complete: number;
  tasks_total: number;
  pending_task_names: string[];
  ceo_resume_hint: string;
} | null> {
  const { data: row, error } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      created_at,
      onboarding_status,
      properties!inner ( user_id ),
      tenants ( full_name, email )
    `,
    )
    .eq("id", tenancyId)
    .maybeSingle();

  if (error || !row) return null;

  const propRaw = row.properties as unknown;
  const property = (Array.isArray(propRaw) ? propRaw[0] : propRaw) as { user_id: string };
  if (property.user_id !== userId) return null;

  const tenRaw = row.tenants as unknown;
  const tenant = (Array.isArray(tenRaw) ? tenRaw[0] : tenRaw) as {
    full_name: string | null;
    email: string | null;
  } | null;

  if (!tenant) return null;

  const onboardingStatus = String((row as { onboarding_status?: string }).onboarding_status ?? "not_started");
  const createdAt =
    typeof (row as { created_at?: string }).created_at === "string" &&
    (row as { created_at: string }).created_at.length > 0
      ? (row as { created_at: string }).created_at
      : new Date(0).toISOString();

  await syncWelcomeEmailTaskIfSent(supabase, tenancyId, userId, tenant.email, createdAt);

  const { data: taskRows } = await supabase
    .from("onboarding_tasks")
    .select("task_name, status")
    .eq("tenancy_id", tenancyId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const tasks = (taskRows ?? []).map((t) => ({
    task_name: String(t.task_name ?? ""),
    status: String(t.status ?? ""),
  }));
  const tasksTotal = tasks.length;
  const tasksComplete = tasks.filter((t) => t.status === "complete").length;
  const pending = tasks.filter((t) => t.status !== "complete").map((t) => t.task_name);

  const referencingComplete = onboardingStatus === "contract_sent" || onboardingStatus === "complete";

  const ceo_resume_hint = referencingComplete
    ? "Referencing is already done (**referencing_complete**: true). Do **not** say the user must wait for the referencing agency. List **pending_task_names** and ask if they want help with the next items (e.g. draft contract with **draft_contract**, then move-in email when contract work is done)."
    : "Summarize **pending_task_names** and offer help with the next steps.";

  return {
    onboarding_status: onboardingStatus,
    referencing_complete: referencingComplete,
    tasks,
    tasks_complete: tasksComplete,
    tasks_total: tasksTotal,
    pending_task_names: pending,
    ceo_resume_hint,
  };
}

async function buildOnboardingResumeResult(
  supabase: SupabaseClient,
  tenancyId: string,
  userId: string,
  row: Record<string, unknown>,
  tenant: { full_name: string | null; email: string | null },
  propertyAddress: string,
): Promise<TenantOnboardingResult> {
  const snap = await getOnboardingChatSnapshotForTenancy(supabase, userId, tenancyId);
  if (!snap) {
    return {
      success: false,
      agentRunId: null,
      tasksCreated: 0,
      emailStatus: "failed",
      message: "Could not load onboarding tasks",
    };
  }

  const tenantName = tenant.full_name?.trim() || "Tenant";
  const pendingLine = snap.pending_task_names.length > 0 ? snap.pending_task_names.join("; ") : "none";

  return {
    success: true,
    mode: "resume",
    agentRunId: null,
    tasksCreated: 0,
    emailStatus: "skipped",
    tenancy_id: tenancyId,
    tenant_name: tenantName,
    property_address: propertyAddress,
    onboarding_status: snap.onboarding_status,
    referencing_complete: snap.referencing_complete,
    tasks: snap.tasks,
    tasks_complete: snap.tasks_complete,
    tasks_total: snap.tasks_total,
    pending_task_names: snap.pending_task_names,
    message: snap.referencing_complete
      ? `Onboarding in progress for **${tenantName}** at ${propertyAddress}. Referencing is complete on this tenancy. Remaining checklist: ${pendingLine}.`
      : `Onboarding in progress for **${tenantName}** at ${propertyAddress}. Remaining checklist: ${pendingLine}.`,
    ceo_resume_hint: snap.ceo_resume_hint,
  };
}

/**
 * Build the same welcome email the onboarding agent would send, for any tenancy stage
 * where the landlord still owns the row (used after dashboard approval).
 */
export async function buildWelcomeEmailForTenancy(
  supabase: SupabaseClient,
  userId: string,
  tenancyId: string,
): Promise<
  | { ok: false; error: string }
  | { ok: true; to: string; toName: string; subject: string; body: string; html?: string }
> {
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
      properties!inner ( user_id, address ),
      tenants ( full_name, email, phone )
    `,
    )
    .eq("id", tenancyId)
    .maybeSingle();

  if (fetchError || !row) {
    return { ok: false, error: fetchError?.message ?? "Tenancy not found" };
  }

  const propRaw = row.properties as unknown;
  const property = (Array.isArray(propRaw) ? propRaw[0] : propRaw) as {
    user_id: string;
    address: string | null;
  };
  const tenRaw = row.tenants as unknown;
  const tenant = (Array.isArray(tenRaw) ? tenRaw[0] : tenRaw) as {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;

  if (!property || !tenant) {
    return { ok: false, error: "Missing property or tenant data" };
  }

  if (property.user_id !== userId) {
    return { ok: false, error: "Forbidden" };
  }

  const startDateIso = row.start_date ?? new Date().toISOString().slice(0, 10);
  const moveInExplicit = (row as { move_in_date?: string | null }).move_in_date;
  const moveInDate =
    (typeof moveInExplicit === "string" && moveInExplicit.trim() !== ""
      ? moveInExplicit.trim()
      : null) ?? startDateIso;
  const propertyAddress =
    normalizePropertyAddressLabel(property.address?.trim() ?? "") || "the property";

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
    return { ok: false, error: "Tenant has no email address" };
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

  const { subject, body, html } = await buildWelcomeEmail(ctx);
  return { ok: true, to: tenantEmail, toName: tenantName, subject, body, html };
}

export async function runTenantOnboardingAgent(
  tenancyId: string,
  userId: string,
  supabaseClient?: SupabaseClient,
  options?: RunTenantOnboardingAgentOptions,
): Promise<TenantOnboardingResult> {
  const supabase = supabaseClient ?? (await createClient());
  const runCorrelationId =
    typeof options?.runCorrelationId === "string" && options.runCorrelationId.trim() !== ""
      ? options.runCorrelationId.trim()
      : undefined;

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
      created_at,
      properties!inner ( user_id, address ),
      tenants ( full_name, email, phone )
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
  };
  const tenRaw = row.tenants as unknown;
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
  const propertyAddressEarly =
    normalizePropertyAddressLabel(property.address?.trim() ?? "") || "the property";

  if (onboardingStatus !== "not_started") {
    return buildOnboardingResumeResult(
      supabase,
      tenancyId,
      userId,
      row as Record<string, unknown>,
      tenant,
      propertyAddressEarly,
    );
  }

  const startDateIso = row.start_date ?? new Date().toISOString().slice(0, 10);
  const moveInExplicit = (row as { move_in_date?: string | null }).move_in_date;
  const moveInDate =
    (typeof moveInExplicit === "string" && moveInExplicit.trim() !== ""
      ? moveInExplicit.trim()
      : null) ?? startDateIso;
  const propertyAddress =
    normalizePropertyAddressLabel(property.address?.trim() ?? "") || "the property";

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

  const { subject, body, html } = await buildWelcomeEmail(ctx);

  const payload = {
    tenancyId,
    tenantName,
    propertyAddress,
    moveInDate,
    subject,
    monthlyRent: ctx.monthlyRent,
    depositAmount: ctx.depositAmount,
    ...(runCorrelationId ? { run_correlation_id: runCorrelationId } : {}),
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

  let sendResult: {
    sent: boolean;
    error?: string | null;
    emailLogId?: string | null;
    message?: string;
  };
  let approvalId: string | null = null;

  if (REQUIRE_APPROVAL_FOR_WELCOME_EMAIL) {
    const evidence: SendOnboardingEmailEvidence = {
      tenantName: ctx.tenantName,
      tenantEmail: ctx.tenantEmail,
      propertyAddress: ctx.propertyAddress,
      subject,
      ...(runCorrelationId ? { run_correlation_id: runCorrelationId } : {}),
    };

    const approval = await createAgentApproval(
      {
        agentRunId,
        agentType: "tenant_onboarding",
        title: "Approve tenant welcome email",
        summary: "The onboarding agent wants to send the welcome email to the tenant.",
        actionType: "send_onboarding_email",
        targetType: "tenancy",
        targetId: tenancyId,
        payload: {
          tenancyId,
          userId,
          emailSubject: subject,
          emailBody: body,
        },
        evidence,
      } satisfies CreateAgentApprovalContract,
      { supabase, userId },
    );
    if (!approval.ok) {
      return {
        success: false,
        agentRunId,
        tasksCreated: 0,
        emailStatus: "failed",
        message: approval.error,
      };
    }
    approvalId = approval.id;
    sendResult = {
      sent: false,
      emailLogId: null,
      message: "Welcome email awaiting approval",
    };
  } else {
    sendResult = await sendEmailTool(supabase, userId, agentRunId, {
      to: ctx.tenantEmail,
      toName: ctx.tenantName,
      subject,
      body,
      html,
      agentType: "onboarding",
      templateType: "welcome",
    });
  }

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
      task_name: "Prepare tenancy agreement (contract not sent by agent)",
      task_type: "manual",
      status: "pending",
      email_log_id: null,
      due_date: null,
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
      status: REQUIRE_APPROVAL_FOR_WELCOME_EMAIL ? "pending" : "completed",
      payload: {
        ...payload,
        approvalId,
        approvalRequiredForWelcomeEmail: REQUIRE_APPROVAL_FOR_WELCOME_EMAIL,
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
