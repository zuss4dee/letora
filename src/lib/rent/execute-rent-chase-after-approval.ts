import type { SupabaseClient } from "@supabase/supabase-js";

import { sendEmailTool } from "@/lib/tools/send-email";

export type ExecuteRentChaseAfterApprovalResult =
  | { ok: true; kind: "sent"; emailLogId: string }
  | { ok: true; kind: "already_sent"; emailLogId: string | null }
  | { ok: false; error: string };

function readPayloadUserId(payload: Record<string, unknown>): string | null {
  const raw = payload.userId;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

function readRentPaymentId(payload: Record<string, unknown>, targetId: string | null): string | null {
  const raw = payload.rentPaymentId;
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  if (typeof targetId === "string" && targetId.trim() !== "") return targetId.trim();
  return null;
}

async function findExistingRentChaseSend(
  supabase: SupabaseClient,
  userId: string,
  agentRunId: string | null,
): Promise<string | null> {
  if (!agentRunId) return null;

  const { data: logRow } = await supabase
    .from("email_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_run_id", agentRunId)
    .eq("agent_type", "rent_chaser")
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (logRow?.id && typeof logRow.id === "string") return logRow.id;
  return null;
}

async function mergeAgentRunAfterRentChaseSend(
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
        rentChaseSentAfterApprovalId: approvalId,
      },
    })
    .eq("id", agentRunId)
    .eq("user_id", userId);
}

/**
 * Idempotent rent chase send after dashboard approval. Uses `forceSend` so human approval
 * is not blocked by `auto_send_rent_chaser`.
 */
export async function executeSendRentChaseAfterApproval(
  supabase: SupabaseClient,
  userId: string,
  approval: {
    id: string;
    agent_run_id: string | null;
    payload: Record<string, unknown>;
    target_id: string | null;
  },
): Promise<ExecuteRentChaseAfterApprovalResult> {
  const payloadUserId = readPayloadUserId(approval.payload);
  if (payloadUserId !== userId) {
    return { ok: false, error: "Approval payload does not match current user" };
  }

  const rentPaymentId = readRentPaymentId(approval.payload, approval.target_id);
  if (!rentPaymentId) {
    return { ok: false, error: "Missing rent payment id on approval" };
  }

  const { data: payRow, error: payErr } = await supabase
    .from("rent_payments")
    .select("id")
    .eq("id", rentPaymentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (payErr || !payRow) {
    return { ok: false, error: payErr?.message ?? "Rent payment not found" };
  }

  const tenantEmail =
    typeof approval.payload.tenantEmail === "string" ? approval.payload.tenantEmail.trim() : "";
  const tenantName =
    typeof approval.payload.tenantName === "string" && approval.payload.tenantName.trim() !== ""
      ? approval.payload.tenantName.trim()
      : "Tenant";
  const subject =
    typeof approval.payload.emailSubject === "string" && approval.payload.emailSubject.trim() !== ""
      ? approval.payload.emailSubject.trim()
      : "Outstanding rent payment reminder";
  const body =
    typeof approval.payload.emailBody === "string" && approval.payload.emailBody.trim() !== ""
      ? approval.payload.emailBody.trim()
      : "Please contact us regarding your outstanding rent payment as soon as possible.";

  if (!tenantEmail) {
    return { ok: false, error: "No tenant email on approval payload" };
  }

  const existingId = await findExistingRentChaseSend(supabase, userId, approval.agent_run_id);

  if (existingId) {
    if (approval.agent_run_id) {
      await mergeAgentRunAfterRentChaseSend(
        supabase,
        userId,
        approval.agent_run_id,
        approval.id,
        existingId,
        true,
      );
    }
    return { ok: true, kind: "already_sent", emailLogId: existingId };
  }

  const sendResult = await sendEmailTool(supabase, userId, approval.agent_run_id, {
    to: tenantEmail,
    toName: tenantName,
    subject,
    body,
    agentType: "rent_chaser",
    templateType: "chase",
    forceSend: true,
  });

  if (!sendResult.sent) {
    return {
      ok: false,
      error: sendResult.error ?? sendResult.message ?? "Rent chase email was not sent",
    };
  }

  const emailLogId = sendResult.emailLogId;

  if (approval.agent_run_id) {
    await mergeAgentRunAfterRentChaseSend(supabase, userId, approval.agent_run_id, approval.id, emailLogId, true);
  }

  return { ok: true, kind: "sent", emailLogId };
}
