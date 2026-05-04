import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { sendMoveInInstructionsEmail } from "@/lib/onboarding/send-move-in-email";

export type ExecuteMoveInAfterApprovalResult =
  | { ok: true; kind: "sent"; emailLogId: string }
  | { ok: true; kind: "already_sent"; emailLogId: string | null }
  | { ok: false; error: string };

function readPayloadUserId(payload: Record<string, unknown>): string | null {
  const raw = payload.userId;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

function readTenancyId(payload: Record<string, unknown>, targetId: string | null): string | null {
  const raw = payload.tenancyId;
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  if (typeof targetId === "string" && targetId.trim() !== "") return targetId.trim();
  return null;
}

async function findExistingMoveInSend(
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
    .eq("task_name", "Send move-in instructions email")
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
      .ilike("subject", "Move-in instructions%")
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (logRow?.id && typeof logRow.id === "string") return logRow.id;
  }

  return null;
}

async function mergeAgentRunAfterMoveInSend(
  supabase: SupabaseClient,
  userId: string,
  agentRunId: string,
  approvalId: string,
  emailLogId: string,
  emailSent: boolean,
): Promise<void> {
  const { data: runRow } = await supabase
    .from("agent_runs")
    .select("payload")
    .eq("id", agentRunId)
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
        emailSent,
        moveInEmailSentAfterApprovalId: approvalId,
      },
    })
    .eq("id", agentRunId)
    .eq("user_id", userId);
}

function revalidateTenancyOperationalSurfaces(tenancyId: string) {
  revalidatePath("/dashboard/tenancies");
  revalidatePath(`/dashboard/tenancies/${tenancyId}`);
}

/**
 * Idempotent move-in send after dashboard approval. Uses `forceSend` inside `sendMoveInInstructionsEmail`.
 */
export async function executeSendMoveInEmailAfterApproval(
  supabase: SupabaseClient,
  userId: string,
  approval: {
    id: string;
    agent_run_id: string | null;
    payload: Record<string, unknown>;
    target_id: string | null;
  },
): Promise<ExecuteMoveInAfterApprovalResult> {
  const payloadUserId = readPayloadUserId(approval.payload);
  if (payloadUserId !== userId) {
    return { ok: false, error: "Approval payload does not match current user" };
  }

  const tenancyId = readTenancyId(approval.payload, approval.target_id);
  if (!tenancyId) {
    return { ok: false, error: "Missing tenancy id on approval" };
  }

  const existingId = await findExistingMoveInSend(supabase, userId, tenancyId, approval.agent_run_id);

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
      .eq("task_name", "Send move-in instructions email")
      .eq("status", "pending");

    if (approval.agent_run_id) {
      await mergeAgentRunAfterMoveInSend(supabase, userId, approval.agent_run_id, approval.id, existingId, true);
    }
    revalidateTenancyOperationalSurfaces(tenancyId);
    return { ok: true, kind: "already_sent", emailLogId: existingId };
  }

  const sendResult = await sendMoveInInstructionsEmail(supabase, tenancyId, userId, approval.agent_run_id);

  if (!sendResult.sent) {
    return {
      ok: false,
      error: sendResult.error ?? sendResult.message ?? "Move-in email was not sent",
    };
  }

  const emailLogId = sendResult.emailLogId;

  if (approval.agent_run_id) {
    await mergeAgentRunAfterMoveInSend(supabase, userId, approval.agent_run_id, approval.id, emailLogId, true);
  }

  revalidateTenancyOperationalSurfaces(tenancyId);
  return { ok: true, kind: "sent", emailLogId };
}
