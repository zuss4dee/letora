import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreateAgentApprovalContract } from "@/lib/approvals/types";

function rentChaseTenantIdFromPayload(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null;
  const raw = payload.tenantId;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t !== "" ? t : null;
}

/**
 * Insert a pending agent_approvals row. Does not revalidate caches — callers in app code
 * should do that (e.g. server actions).
 *
 * When `targetId` is set, reuses a single pending row per (user, action_type, target_id):
 * updates title/summary/payload/evidence/agent_run_id/target_id instead of inserting a duplicate.
 *
 * For `send_rent_chase_email`, also reuses a pending row per tenant (`payload.tenantId`) so
 * chasing a different overdue instalment for the same tenant does not add a second approval.
 * Rows with no `targetId` and no tenant id on payload behave as plain inserts (unchanged).
 */
export async function insertPendingAgentApproval(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAgentApprovalContract,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const targetId = input.targetId?.trim() ?? "";
  const payload = (input.payload ?? {}) as Record<string, unknown>;

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

  const chaseTenantId =
    input.actionType === "send_rent_chase_email" ? rentChaseTenantIdFromPayload(payload) : null;

  if (chaseTenantId) {
    const { data: tenantRows, error: tenantFindErr } = await supabase
      .from("agent_approvals")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("action_type", "send_rent_chase_email")
      .contains("payload", { tenantId: chaseTenantId })
      .order("created_at", { ascending: true })
      .limit(1);

    if (tenantFindErr) {
      return { ok: false, error: tenantFindErr.message };
    }

    const tenantRowId = tenantRows?.[0]?.id;
    if (tenantRowId) {
      const out = await applyPendingUpdate(tenantRowId);
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
