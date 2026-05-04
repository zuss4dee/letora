import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentApprovalExecutionSlice } from "@/lib/approvals/types";
import { executeSendOnboardingWelcomeAfterApproval } from "@/lib/onboarding/execute-welcome-after-approval";
import { executeMaintenanceDispatchAfterApproval } from "@/lib/maintenance/execute-maintenance-dispatch-after-approval";
import { executeSendMoveInEmailAfterApproval } from "@/lib/onboarding/execute-move-in-after-approval";
import { executeSendRentChaseAfterApproval } from "@/lib/rent/execute-rent-chase-after-approval";

/** Result of running side effects after an approval row is marked `approved` (before → `executed`). */
export type ApprovedSideEffectResult = { ok: true } | { ok: false; error: string };

/**
 * Narrow dispatcher: one explicit branch per `AgentApprovalActionType`. Add new cases when
 * introducing approval-gated sends or dispatches — no plugin registry. Unknown runtime values fail closed
 * so a row cannot sit `approved` with no handler.
 */
export async function runApprovedAgentSideEffect(
  supabase: SupabaseClient,
  userId: string,
  approval: AgentApprovalExecutionSlice,
): Promise<ApprovedSideEffectResult> {
  switch (approval.action_type) {
    case "send_onboarding_email": {
      const exec = await executeSendOnboardingWelcomeAfterApproval(supabase, userId, {
        id: approval.id,
        agent_run_id: approval.agent_run_id,
        payload: approval.payload,
        target_id: approval.target_id,
      });
      if (!exec.ok) {
        return { ok: false, error: exec.error };
      }
      return { ok: true };
    }
    case "send_rent_chase_email": {
      const exec = await executeSendRentChaseAfterApproval(supabase, userId, {
        id: approval.id,
        agent_run_id: approval.agent_run_id,
        payload: approval.payload,
        target_id: approval.target_id,
      });
      if (!exec.ok) {
        return { ok: false, error: exec.error };
      }
      return { ok: true };
    }
    case "approve_maintenance_dispatch": {
      const exec = await executeMaintenanceDispatchAfterApproval(supabase, userId, {
        id: approval.id,
        agent_run_id: approval.agent_run_id,
        payload: approval.payload,
        target_id: approval.target_id,
      });
      if (!exec.ok) {
        return { ok: false, error: exec.error };
      }
      return { ok: true };
    }
    case "send_move_in_email": {
      const exec = await executeSendMoveInEmailAfterApproval(supabase, userId, {
        id: approval.id,
        agent_run_id: approval.agent_run_id,
        payload: approval.payload,
        target_id: approval.target_id,
      });
      if (!exec.ok) {
        return { ok: false, error: exec.error };
      }
      return { ok: true };
    }
    default: {
      const unknown: never = approval.action_type;
      return {
        ok: false,
        error: `Unsupported approval action_type "${String(unknown)}". Register a branch in execute-approved-action.`,
      };
    }
  }
}

/** Alias for callers that think in terms of “execute this approved action”. */
export const executeApprovedAgentAction = runApprovedAgentSideEffect;
