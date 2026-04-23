import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreateAgentApprovalContract } from "@/lib/approvals/types";

/**
 * Insert a pending agent_approvals row. Does not revalidate caches — callers in app code
 * should do that (e.g. server actions).
 */
export async function insertPendingAgentApproval(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAgentApprovalContract,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("agent_approvals")
    .insert({
      user_id: userId,
      agent_run_id: input.agentRunId ?? null,
      agent_type: input.agentType,
      title: input.title,
      summary: input.summary ?? null,
      action_type: input.actionType,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      payload: input.payload ?? {},
      evidence: input.evidence ?? {},
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "Could not create approval request" };
  }

  return { ok: true, id: data.id as string };
}
