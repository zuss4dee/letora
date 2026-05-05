import type { SupabaseClient } from "@supabase/supabase-js";

/** Undo “approved” when a side effect fails — restores pending for retry. */
export async function revertAgentApprovalToPending(
  supabase: SupabaseClient,
  userId: string,
  approvalId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("agent_approvals")
    .update({
      status: "pending",
      decided_by: null,
      decided_at: null,
    })
    .eq("id", approvalId)
    .eq("user_id", userId)
    .eq("status", "approved");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markAgentApprovalExecuted(
  supabase: SupabaseClient,
  userId: string,
  approvalId: string,
  executedAtIso: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("agent_approvals")
    .update({
      status: "executed",
      executed_at: executedAtIso,
    })
    .eq("id", approvalId)
    .eq("user_id", userId)
    .eq("status", "approved");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Side effects may have already run when the first `markAgentApprovalExecuted` fails (network).
 * Retries reduce stuck `approved` rows without re-running execution (client uses idempotency).
 */
export async function markAgentApprovalExecutedWithRetry(
  supabase: SupabaseClient,
  userId: string,
  approvalId: string,
  executedAtIso: string,
  attempts = 3,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let lastErr = "Unknown error";
  for (let i = 0; i < attempts; i++) {
    const r = await markAgentApprovalExecuted(supabase, userId, approvalId, executedAtIso);
    if (r.ok === true) {
      return r;
    }
    lastErr = r.error;
    await delay(80 * (i + 1));
  }
  return { ok: false, error: lastErr };
}
