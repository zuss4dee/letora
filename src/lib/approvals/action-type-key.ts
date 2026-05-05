import type { AgentApprovalActionType } from "@/lib/approvals/types";

const KNOWN: readonly AgentApprovalActionType[] = [
  "send_onboarding_email",
  "send_rent_chase_email",
  "send_move_in_email",
  "approve_maintenance_dispatch",
] as const;

const KNOWN_SET = new Set<string>(KNOWN);

/**
 * Returns a known `AgentApprovalActionType` or null if the value is missing or not supported
 * (e.g. legacy or corrupted `agent_approvals.action_type`). Use before executing side effects.
 */
export function parseAgentApprovalActionType(raw: string | null | undefined): AgentApprovalActionType | null {
  const key = approvalActionTypeKey(raw);
  return KNOWN_SET.has(key) ? (key as AgentApprovalActionType) : null;
}

/**
 * Stable key for grouping / filtering approvals by `action_type`.
 * Normalizes casing and whitespace so UI filters match rows from `agent_approvals`
 * even if legacy rows differ slightly.
 */
export function approvalActionTypeKey(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (t.length === 0) return "";
  if (KNOWN_SET.has(t)) return t;
  const lower = t.toLowerCase();
  for (const k of KNOWN) {
    if (k === lower) return k;
  }
  return t;
}
