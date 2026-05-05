/** Shared presentation helpers for agent approvals (dashboard UI only). */

import { APPROVAL_PENDING_STALE_MS } from "@/lib/approvals/queue-stats";

export function formatApprovalAgentType(agentType: string): string {
  return agentType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function formatApprovalActionType(actionType: string): string {
  return actionType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function formatApprovalAbsoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isApprovalPendingStale(
  createdAtIso: string,
  staleAfterMs: number = APPROVAL_PENDING_STALE_MS,
): boolean {
  const t = new Date(createdAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t >= staleAfterMs;
}

export function formatApprovalRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 45) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(diffSec / 86400), "day");
  return rtf.format(Math.round(diffSec / 604800), "week");
}

/** Compact elapsed time for queue ops (past events only). */
export function formatApprovalShortRelativeAge(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return formatApprovalRelativeTime(iso);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}m ago`;
  if (sec < 86400) return `${Math.max(1, Math.floor(sec / 3600))}h ago`;
  if (sec < 604800) return `${Math.max(1, Math.floor(sec / 86400))}d ago`;
  const w = Math.max(1, Math.floor(sec / 604800));
  return `${w}w ago`;
}

export function formatApprovalTargetLine(targetType: string | null, targetId: string | null): string | null {
  if (!targetType?.trim() || !targetId?.trim()) return null;
  const label = targetType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return `${label} · ${targetId.slice(0, 8)}…`;
}

export function formatApprovalDecisionStatus(status: string): string {
  switch (status) {
    case "executed":
      return "Completed";
    case "denied":
      return "Denied";
    case "approved":
      return "Approved";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}
