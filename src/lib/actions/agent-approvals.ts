"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentApprovalActionType, AgentApprovalRow } from "@/lib/approvals/types";
import { createClient } from "@/lib/supabase/server";

type CreateAgentApprovalInput = {
  agentRunId?: string | null;
  agentType: string;
  title: string;
  summary?: string | null;
  actionType: AgentApprovalActionType;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
};

type ActionResult = { ok: true } | { ok: false; error: string };

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

export async function getPendingAgentApprovals(): Promise<AgentApprovalRow[]> {
  const actor = await getActor();
  if (!actor) return [];

  const { data, error } = await actor.supabase
    .from("agent_approvals")
    .select(
      "id,user_id,agent_run_id,agent_type,title,summary,action_type,target_type,target_id,payload,evidence,status,decided_by,decided_at,deny_reason,executed_at,created_at",
    )
    .eq("user_id", actor.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[getPendingAgentApprovals]", error.message);
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

export async function createAgentApproval(
  input: CreateAgentApprovalInput,
  opts?: { supabase?: SupabaseClient; userId?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const actor = await getActor(opts?.supabase, opts?.userId);
  if (!actor) return { ok: false, error: "Not authenticated" };

  const { data, error } = await actor.supabase
    .from("agent_approvals")
    .insert({
      user_id: actor.userId,
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

  revalidatePath("/dashboard/approvals");
  return { ok: true, id: data.id as string };
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

  revalidatePath("/dashboard/approvals");
  return { ok: true };
}

export async function approveAgentApproval(approvalId: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Not authenticated" };

  const { data: approval, error: fetchError } = await actor.supabase
    .from("agent_approvals")
    .select("id,action_type,status")
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

  if (approval.action_type === "send_onboarding_email") {
    // MVP guarantee: approval handling is database-only.
    // Do not send emails or trigger external side effects from this action.
    const { error: executeError } = await actor.supabase
      .from("agent_approvals")
      .update({
        status: "executed",
        executed_at: now,
      })
      .eq("id", approvalId)
      .eq("user_id", actor.userId)
      .eq("status", "approved");

    if (executeError) {
      return { ok: false, error: executeError.message };
    }
  }

  revalidatePath("/dashboard/approvals");
  return { ok: true };
}
