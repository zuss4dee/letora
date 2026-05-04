"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { markAgentApprovalExecuted, revertAgentApprovalToPending } from "@/lib/approvals/approval-lifecycle";
import { insertPendingAgentApproval } from "@/lib/approvals/create-agent-approval";
import { runApprovedAgentSideEffect } from "@/lib/approvals/execute-approved-action";
import { normalizeApprovalJsonField } from "@/lib/approvals/evidence";
import type {
  AgentApprovalActionType,
  AgentApprovalExecutionSlice,
  AgentApprovalRow,
  CreateAgentApprovalContract,
} from "@/lib/approvals/types";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/actions/activity-log";

type ActionResult = { ok: true } | { ok: false; error: string };

export type ApproveAgentApprovalResult =
  | { ok: true; actionType: AgentApprovalActionType }
  | { ok: false; error: string };

async function getActor(
  supabase?: SupabaseClient,
  userId?: string,
): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  if (supabase && userId) {
    return { supabase, userId };
  }
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  return { supabase: client, userId: user.id };
}

export async function getPendingAgentApprovals(limit?: number): Promise<AgentApprovalRow[]> {
  const actor = await getActor();
  if (!actor) return [];

  let query = actor.supabase
    .from("agent_approvals")
    .select(
      "id,user_id,agent_run_id,agent_type,title,summary,action_type,target_type,target_id,payload,evidence,status,decided_by,decided_at,deny_reason,executed_at,created_at",
    )
    .eq("user_id", actor.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[getPendingAgentApprovals]", error.message);
    return [];
  }

  return (data ?? []) as AgentApprovalRow[];
}

const APPROVALS_REVALIDATE_PATHS = [
  "/dashboard/approvals",
  "/dashboard",
  "/dashboard/home",
  "/dashboard/assistant",
  "/dashboard/tenants",
  "/dashboard/properties",
  "/dashboard/tenancies",
  "/dashboard/maintenance",
  "/dashboard/rent-tracker",
  "/dashboard/rent",
  "/dashboard/emails",
  "/dashboard/contracts",
  "/dashboard/settings",
  "/dashboard/leads",
] as const;

function revalidateApprovalsSurfaces() {
  for (const p of APPROVALS_REVALIDATE_PATHS) {
    revalidatePath(p);
  }
}

/** Recent decisions for audit / context (non-pending). */
export async function getRecentResolvedAgentApprovals(limit = 12): Promise<AgentApprovalRow[]> {
  const actor = await getActor();
  if (!actor) return [];

  const { data, error } = await actor.supabase
    .from("agent_approvals")
    .select(
      "id,user_id,agent_run_id,agent_type,title,summary,action_type,target_type,target_id,payload,evidence,status,decided_by,decided_at,deny_reason,executed_at,created_at",
    )
    .eq("user_id", actor.userId)
    .in("status", ["executed", "denied", "approved"])
    .order("decided_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.warn("[getRecentResolvedAgentApprovals]", error.message);
    return [];
  }

  return (data ?? []) as AgentApprovalRow[];
}

export async function getPendingApprovalsForTenancy(tenancyId: string): Promise<AgentApprovalRow[]> {
  const actor = await getActor();
  if (!actor) return [];

  const { data, error } = await actor.supabase
    .from("agent_approvals")
    .select(
      "id,user_id,agent_run_id,agent_type,title,summary,action_type,target_type,target_id,payload,evidence,status,decided_by,decided_at,deny_reason,executed_at,created_at",
    )
    .eq("user_id", actor.userId)
    .eq("status", "pending")
    .eq("target_type", "tenancy")
    .eq("target_id", tenancyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[getPendingApprovalsForTenancy]", error.message);
    return [];
  }

  return (data ?? []) as AgentApprovalRow[];
}

export async function getPendingApprovalsForMaintenance(): Promise<AgentApprovalRow[]> {
  const actor = await getActor();
  if (!actor) return [];

  const { data, error } = await actor.supabase
    .from("agent_approvals")
    .select(
      "id,user_id,agent_run_id,agent_type,title,summary,action_type,target_type,target_id,payload,evidence,status,decided_by,decided_at,deny_reason,executed_at,created_at",
    )
    .eq("user_id", actor.userId)
    .eq("status", "pending")
    .eq("action_type", "approve_maintenance_dispatch")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[getPendingApprovalsForMaintenance]", error.message);
    return [];
  }

  return (data ?? []) as AgentApprovalRow[];
}

export async function getPendingApprovalsForRentChase(): Promise<AgentApprovalRow[]> {
  const actor = await getActor();
  if (!actor) return [];

  const { data, error } = await actor.supabase
    .from("agent_approvals")
    .select(
      "id,user_id,agent_run_id,agent_type,title,summary,action_type,target_type,target_id,payload,evidence,status,decided_by,decided_at,deny_reason,executed_at,created_at",
    )
    .eq("user_id", actor.userId)
    .eq("status", "pending")
    .eq("action_type", "send_rent_chase_email")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[getPendingApprovalsForRentChase]", error.message);
    return [];
  }

  return (data ?? []) as AgentApprovalRow[];
}

export async function createAgentApproval(
  input: CreateAgentApprovalContract,
  opts?: { supabase?: SupabaseClient; userId?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const actor = await getActor(opts?.supabase, opts?.userId);
  if (!actor) return { ok: false, error: "Not authenticated" };

  const inserted = await insertPendingAgentApproval(actor.supabase, actor.userId, input);
  if (!inserted.ok) return inserted;

  revalidateApprovalsSurfaces();
  
  // Log activity
  await logActivity({
    userId: actor.userId,
    eventType: `PROPOSED: ${input.agentType.toUpperCase().replace(/_/g, " ")}`,
    source: "assistant",
    args: { approvalId: inserted.id, actionType: input.actionType },
  }, actor.supabase);

  return { ok: true, id: inserted.id };
}

export async function denyAgentApproval(
  approvalId: string,
  denyReason?: string,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Not authenticated" };

  const now = new Date().toISOString();
  const { error } = await actor.supabase
    .from("agent_approvals")
    .update({
      status: "denied",
      decided_by: actor.userId,
      decided_at: now,
      deny_reason: denyReason?.trim() ? denyReason.trim() : null,
    })
    .eq("id", approvalId)
    .eq("user_id", actor.userId)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };

  revalidateApprovalsSurfaces();

  // Log activity
  await logActivity({
    userId: actor.userId,
    eventType: `DENIED: ACTION`,
    source: "landlord",
    args: { approvalId, denyReason },
  }, actor.supabase);

  return { ok: true };
}

export async function approveAgentApproval(approvalId: string): Promise<ApproveAgentApprovalResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Not authenticated" };

  const { data: approval, error: fetchError } = await actor.supabase
    .from("agent_approvals")
    .select("id,action_type,status,payload,target_id,agent_run_id")
    .eq("id", approvalId)
    .eq("user_id", actor.userId)
    .maybeSingle();

  if (fetchError || !approval) {
    return { ok: false, error: fetchError?.message ?? "Approval not found" };
  }
  if (approval.status !== "pending") {
    return { ok: false, error: "Approval is no longer pending" };
  }

  const now = new Date().toISOString();
  const { error: approveError } = await actor.supabase
    .from("agent_approvals")
    .update({
      status: "approved",
      decided_by: actor.userId,
      decided_at: now,
    })
    .eq("id", approvalId)
    .eq("user_id", actor.userId)
    .eq("status", "pending");

  if (approveError) {
    return { ok: false, error: approveError.message };
  }

  const executionSlice: AgentApprovalExecutionSlice = {
    id: approval.id,
    action_type: approval.action_type,
    agent_run_id: approval.agent_run_id,
    target_id: approval.target_id,
    payload: normalizeApprovalJsonField(approval.payload),
  };

  const sideEffect = await runApprovedAgentSideEffect(actor.supabase, actor.userId, executionSlice);

  if (!sideEffect.ok) {
    const reverted = await revertAgentApprovalToPending(actor.supabase, actor.userId, approvalId);
    if (!reverted.ok) {
      return { ok: false, error: `${sideEffect.error} (also failed to restore pending: ${reverted.error})` };
    }
    return { ok: false, error: sideEffect.error };
  }

  const executedAt = new Date().toISOString();
  const marked = await markAgentApprovalExecuted(actor.supabase, actor.userId, approvalId, executedAt);
  if (!marked.ok) {
    return { ok: false, error: marked.error };
  }

  revalidateApprovalsSurfaces();

  // Log activity
  await logActivity({
    userId: actor.userId,
    eventType: `APPROVED & EXECUTED: ${approval.action_type.toUpperCase().replace(/_/g, " ")}`,
    source: "landlord",
    args: { approvalId, actionType: approval.action_type, targetId: approval.target_id },
    success: true,
  }, actor.supabase);

  return { ok: true, actionType: approval.action_type };
}

export async function getPendingApprovalsCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("agent_approvals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) {
    console.warn("[getPendingApprovalsCount]", error.message);
    return 0;
  }
  return count ?? 0;
}
