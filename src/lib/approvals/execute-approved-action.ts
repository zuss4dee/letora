import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentApprovalExecutionSlice } from "@/lib/approvals/types";
import { executeSendOnboardingWelcomeAfterApproval } from "@/lib/onboarding/execute-welcome-after-approval";
import { executeMaintenanceDispatchAfterApproval } from "@/lib/maintenance/execute-maintenance-dispatch-after-approval";
import { executeSendMoveInEmailAfterApproval } from "@/lib/onboarding/execute-move-in-after-approval";
import { executeSendRentChaseAfterApproval } from "@/lib/rent/execute-rent-chase-after-approval";

/**
 * Result of running side effects after an approval is marked `approved`.
 * - `markExecuted: true` → caller should set status `executed` (welcome email, etc.).
 * - `markExecuted: false` → leave row `approved` (no automated side effect for this action type).
 */
export type ApprovedSideEffectResult =
  | { ok: true; markExecuted: true }
  | { ok: true; markExecuted: false }
  | { ok: false; error: string };

/**
 * Narrow dispatcher: one explicit branch per action_type. Add new cases here when
 * introducing approval-gated sends or dispatches — no plugin registry.
 */
export async function runApprovedAgentSideEffect(
  supabase: SupabaseClient,
  userId: string,
  approval: AgentApprovalExecutionSlice,
): Promise<ApprovedSideEffectResult> {
  if (approval.action_type === "send_onboarding_email") {
    const exec = await executeSendOnboardingWelcomeAfterApproval(supabase, userId, {
      id: approval.id,
      agent_run_id: approval.agent_run_id,
      payload: approval.payload,
      target_id: approval.target_id,
    });
    if (!exec.ok) {
      return { ok: false, error: exec.error };
    }
    return { ok: true, markExecuted: true };
  }

  if (approval.action_type === "send_rent_chase_email") {
    const exec = await executeSendRentChaseAfterApproval(supabase, userId, {
      id: approval.id,
      agent_run_id: approval.agent_run_id,
      payload: approval.payload,
      target_id: approval.target_id,
    });
    if (!exec.ok) {
      return { ok: false, error: exec.error };
    }
    return { ok: true, markExecuted: true };
  }

  if (approval.action_type === "approve_maintenance_dispatch") {
    const exec = await executeMaintenanceDispatchAfterApproval(supabase, userId, {
      id: approval.id,
      agent_run_id: approval.agent_run_id,
      payload: approval.payload,
      target_id: approval.target_id,
    });
    if (!exec.ok) {
      return { ok: false, error: exec.error };
    }
    return { ok: true, markExecuted: true };
  }

  if (approval.action_type === "send_move_in_email") {
    const exec = await executeSendMoveInEmailAfterApproval(supabase, userId, {
      id: approval.id,
      agent_run_id: approval.agent_run_id,
      payload: approval.payload,
      target_id: approval.target_id,
    });
    if (!exec.ok) {
      return { ok: false, error: exec.error };
    }
    return { ok: true, markExecuted: true };
  }

  return { ok: true, markExecuted: false };
}

/** Alias for callers that think in terms of “execute this approved action”. */
export const executeApprovedAgentAction = runApprovedAgentSideEffect;
