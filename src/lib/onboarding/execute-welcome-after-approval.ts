import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildWelcomeEmailForTenancy } from "@/lib/agents/tenant-onboarding";
import { sendEmailTool } from "@/lib/tools/send-email";

export type ExecuteWelcomeAfterApprovalResult =
  | { ok: true; kind: "sent"; emailLogId: string }
  | { ok: true; kind: "already_sent"; emailLogId: string | null }
  | { ok: false; error: string };

function readPayloadTenancyId(payload: Record<string, unknown>, targetId: string | null): string | null {
  const raw = payload.tenancyId;
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  if (typeof targetId === "string" && targetId.trim() !== "") return targetId.trim();
  return null;
}

/** Exported for unit tests — resolves tenancy id from stored approval fields. */
export function parseWelcomeApprovalTenancyId(
  payload: Record<string, unknown>,
  targetId: string | null,
): string | null {
  return readPayloadTenancyId(payload, targetId);
}

function readPayloadUserId(payload: Record<string, unknown>): string | null {
  const raw = payload.userId;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

async function findExistingWelcomeSend(
  supabase: SupabaseClient,
  userId: string,
  tenancyId: string,
  agentRunId: string | null,
): Promise<string | null> {
  const { data: taskRow } = await supabase
    .from("onboarding_tasks")
    .select("email_log_id")
    .eq("tenancy_id", tenancyId)
    .eq("user_id", userId)
    .eq("task_name", "Welcome email")
    .eq("status", "complete")
    .not("email_log_id", "is", null)
    .maybeSingle();

  const fromTask = taskRow?.email_log_id;
  if (typeof fromTask === "string" && fromTask.length > 0) {
    return fromTask;
  }

  if (agentRunId) {
    const { data: logRow } = await supabase
      .from("email_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("agent_run_id", agentRunId)
      .eq("agent_type", "onboarding")
      .eq("template_type", "welcome")
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (logRow?.id && typeof logRow.id === "string") return logRow.id;
  }

  return null;
}

function revalidateTenancyOperationalSurfaces(tenancyId: string) {
  revalidatePath("/dashboard/tenancies");
  revalidatePath(`/dashboard/tenancies/${tenancyId}`);
}

/**
 * Idempotent welcome send after dashboard approval. Uses `forceSend` so human approval
 * is not blocked by `auto_send_onboarding_emails`.
 */
export async function executeSendOnboardingWelcomeAfterApproval(
  supabase: SupabaseClient,
  userId: string,
  approval: {
    id: string;
    agent_run_id: string | null;
    payload: Record<string, unknown>;
    target_id: string | null;
  },
): Promise<ExecuteWelcomeAfterApprovalResult> {
  const payloadUserId = readPayloadUserId(approval.payload);
  if (payloadUserId !== userId) {
    return { ok: false, error: "Approval payload does not match current user" };
  }

  const tenancyId = readPayloadTenancyId(approval.payload, approval.target_id);
  if (!tenancyId) {
    return { ok: false, error: "Missing tenancy id on approval" };
  }

  const built = await buildWelcomeEmailForTenancy(supabase, userId, tenancyId);
  if (built.ok === false) {
    return { ok: false, error: built.error };
  }

  const existingId = await findExistingWelcomeSend(supabase, userId, tenancyId, approval.agent_run_id);

  if (existingId) {
    const now = new Date().toISOString();
    await supabase
      .from("onboarding_tasks")
      .update({
        status: "complete",
        completed_at: now,
        email_log_id: existingId,
      })
      .eq("tenancy_id", tenancyId)
      .eq("user_id", userId)
      .eq("task_name", "Welcome email")
      .eq("status", "pending");

    revalidateTenancyOperationalSurfaces(tenancyId);
    return { ok: true, kind: "already_sent", emailLogId: existingId };
  }

  const sendResult = await sendEmailTool(supabase, userId, approval.agent_run_id, {
    to: built.to,
    toName: built.toName,
    subject: built.subject,
    body: built.body,
    html: built.html,
    agentType: "onboarding",
    templateType: "welcome",
    forceSend: true,
  });

  if (!sendResult.sent) {
    return {
      ok: false,
      error: sendResult.error ?? sendResult.message ?? "Welcome email was not sent",
    };
  }

  const emailLogId = sendResult.emailLogId;
  const now = new Date().toISOString();

  await supabase
    .from("onboarding_tasks")
    .update({
      status: "complete",
      completed_at: now,
      email_log_id: emailLogId,
    })
    .eq("tenancy_id", tenancyId)
    .eq("user_id", userId)
    .eq("task_name", "Welcome email")
    .eq("status", "pending");

  if (approval.agent_run_id) {
    const { data: runRow } = await supabase
      .from("agent_runs")
      .select("payload")
      .eq("id", approval.agent_run_id)
      .eq("user_id", userId)
      .maybeSingle();

    const prevPayload =
      runRow?.payload && typeof runRow.payload === "object" && !Array.isArray(runRow.payload)
        ? (runRow.payload as Record<string, unknown>)
        : {};

    await supabase
      .from("agent_runs")
      .update({
        status: "completed",
        payload: {
          ...prevPayload,
          emailLogId,
          sent: true,
          welcomeEmailSentAfterApprovalId: approval.id,
        },
      })
      .eq("id", approval.agent_run_id)
      .eq("user_id", userId);
  }

  revalidateTenancyOperationalSurfaces(tenancyId);
  return { ok: true, kind: "sent", emailLogId };
}
