/**
 * Pure derivation of late-rent chase UI state from batched approval / agent-run signals.
 * Shared by Command Center arrears queue and Rent Tracker.
 */

export type LateRentChaseUiState =
  | "chase_pending"
  | "awaiting_agent"
  | "chased"
  | "no_action";

export type AgentApprovalChaseRow = {
  id: string;
  status: string;
  target_id: string | null;
};

export function rentPaymentIdFromAgentPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const rent = p.rentPaymentId;
  if (typeof rent === "string" && rent.trim() !== "") return rent.trim();
  const inst = p.instalmentId;
  if (typeof inst === "string" && inst.trim() !== "") return inst.trim();
  return null;
}

/** Keys: rent_payments.id → approvals for that instalment (send_rent_chase_email). */
export type LateRentChaseApprovalIndex = Map<string, AgentApprovalChaseRow[]>;

export function deriveLateRentChaseUiState(
  paymentId: string,
  byTarget: LateRentChaseApprovalIndex,
  rentChaserTouchedPaymentIds: Set<string>,
  chasedPaymentIds: Set<string>,
): { state: LateRentChaseUiState; pendingApprovalId: string | null } {
  const rowsForTarget = byTarget.get(paymentId) ?? [];

  const pending = rowsForTarget.find((r) => r.status === "pending");
  if (pending) return { state: "chase_pending", pendingApprovalId: pending.id };

  const hasExecuted = rowsForTarget.some((r) => r.status === "executed");
  if (hasExecuted || chasedPaymentIds.has(paymentId)) {
    return { state: "chased", pendingApprovalId: null };
  }

  const approved = rowsForTarget.find((r) => r.status === "approved");
  if (approved) return { state: "awaiting_agent", pendingApprovalId: null };

  if (rowsForTarget.some((r) => r.status === "denied" || r.status === "expired")) {
    return { state: "no_action", pendingApprovalId: null };
  }

  if (rowsForTarget.length === 0) {
    return rentChaserTouchedPaymentIds.has(paymentId)
      ? { state: "no_action", pendingApprovalId: null }
      : { state: "awaiting_agent", pendingApprovalId: null };
  }

  return { state: "no_action", pendingApprovalId: null };
}

/** Alias for {@link deriveLateRentChaseUiState} — matches historical name in the codebase. */
export const deriveLateRentUiState = deriveLateRentChaseUiState;
