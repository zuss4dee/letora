/**
 * Normalise jsonb / unknown fields from agent_approvals into a plain object for executors.
 */
export function normalizeApprovalJsonField(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
