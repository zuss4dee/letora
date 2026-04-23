import type { AgentApprovalRow } from "@/lib/approvals/types";

/**
 * Pending items older than this are considered “aging” for queue health (not alarmist).
 * Also used by {@link processStaleApprovalReminders} for email reminder eligibility.
 */
export const APPROVAL_PENDING_STALE_MS = 48 * 60 * 60 * 1000;

export type ApprovalQueueStats = {
  pendingTotal: number;
  /** Counts keyed by `action_type` (only types present in the queue). */
  byActionType: Record<string, number>;
  /** ISO timestamp of the oldest pending row, or null if queue empty. */
  oldestPendingCreatedAt: string | null;
  /** How many pending rows are older than {@link APPROVAL_PENDING_STALE_MS}. */
  stalePendingCount: number;
};

export function computeApprovalQueueStats(
  pending: AgentApprovalRow[],
  staleAfterMs: number = APPROVAL_PENDING_STALE_MS,
): ApprovalQueueStats {
  const byActionType: Record<string, number> = {};
  const now = Date.now();
  let oldestPendingCreatedAt: string | null = null;
  let oldestMs = Infinity;
  let stalePendingCount = 0;

  for (const row of pending) {
    const key = row.action_type;
    byActionType[key] = (byActionType[key] ?? 0) + 1;

    const t = new Date(row.created_at).getTime();
    if (!Number.isNaN(t)) {
      if (t < oldestMs) {
        oldestMs = t;
        oldestPendingCreatedAt = row.created_at;
      }
      if (now - t >= staleAfterMs) {
        stalePendingCount += 1;
      }
    }
  }

  return {
    pendingTotal: pending.length,
    byActionType,
    oldestPendingCreatedAt,
    stalePendingCount,
  };
}
