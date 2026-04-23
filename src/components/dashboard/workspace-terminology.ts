/**
 * Shared operator-facing vocabulary for the MVP (dashboard + approvals).
 * Keep in sync with UI copy; do not use for API contracts or stored values.
 */
export const MVP_TERMS = {
  /** Items waiting in Approvals */
  pendingApproval: "Pending approval",
  pendingApprovals: "Pending approvals",
  /** Stale queue health */
  aging: "Aging",
  /** After reminder email */
  reminded: "Reminded",
  /** Email / dispatch went out */
  sent: "Sent",
  /** Finished approval path (includes executed side effects) */
  completed: "Completed",
  /** Agent suggested something not yet approved */
  proposed: "Proposed",
} as const;
