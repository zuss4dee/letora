import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreateAgentApprovalContract } from "@/lib/approvals/types";

/**
 * Insert a pending agent_approvals row. Does not revalidate caches — callers in app code
 * should do that (e.g. server actions).
 *
 * When `targetId` is set, reuses a single pending row per (user, action_type, target_id):
 * updates title/summary/payload/evidence/agent_run_id/target_id instead of inserting a duplicate.
 *
 * Rent chases include `targetId: rent_payment_id`, so duplicate chases for the same instalment collapse;
 * distinct instalments for the same tenant remain separate approvals.
 */
export async function insertPendingAgentApproval(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAgentApprovalContract,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const targetId = input.targetId?.trim() ?? "";

  const applyPendingUpdate = async (rowId: string) => {
    const { error: upErr } = await supabase
      .from("agent_approvals")
      .update({
        agent_run_id: input.agentRunId ?? null,
        agent_type: input.agentType,
        title: input.title,
        summary: input.summary ?? null,
        target_type: input.targetType ?? null,
        target_id: targetId || null,
        payload: input.payload ?? {},
        evidence: input.evidence ?? {},
      })
      .eq("id", rowId)
      .eq("user_id", userId)
      .eq("status", "pending");

    if (upErr) {
      return { ok: false as const, error: upErr.message };
    }
    return { ok: true as const, id: rowId };
  };

  if (targetId) {
    const { data: existingRows, error: findErr } = await supabase
      .from("agent_approvals")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("action_type", input.actionType)
      .eq("target_id", targetId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (findErr) {
      return { ok: false, error: findErr.message };
    }

    const existingId = existingRows?.[0]?.id;
    if (existingId) {
      const out = await applyPendingUpdate(existingId);
      if (!out.ok) return out;
      return { ok: true, id: out.id };
    }
  }

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
      target_id: targetId || null,
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
