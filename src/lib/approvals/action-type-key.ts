import type { AgentApprovalActionType } from "@/lib/approvals/types";

const KNOWN: readonly AgentApprovalActionType[] = [
  "send_onboarding_email",
  "send_rent_chase_email",
  "send_move_in_email",
  "approve_maintenance_dispatch",
] as const;

const KNOWN_SET = new Set<string>(KNOWN);

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
