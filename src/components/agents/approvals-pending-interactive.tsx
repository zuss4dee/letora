"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { approveAgentApproval, denyAgentApproval } from "@/lib/actions/agent-approvals";
import {
  formatApprovalAbsoluteTime,
  formatApprovalActionType,
  formatApprovalAgentType,
  formatApprovalRelativeTime,
  formatApprovalShortRelativeAge,
  formatApprovalTargetLine,
  isApprovalPendingStale,
} from "@/components/dashboard/approval-display";
import { ApprovalAuditSheetTrigger } from "@/components/agents/approval-audit-sheet";
import { MVP_TERMS } from "@/components/dashboard/workspace-terminology";
import { parseStaleReminderAudit } from "@/lib/approvals/stale-approval-reminders";
import type { AgentApprovalRow } from "@/lib/approvals/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ApprovalsPendingInteractive({
  approvals,
  emphasizeQueueAge = false,
}: {
  approvals: AgentApprovalRow[];
  /** When true, use compact ages, oldest-first context, and muted “Aging” signal (approvals ops view). */
  emphasizeQueueAge?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const runApprove = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const r = await approveAgentApproval(id);
        if (r.ok) {
          toast.success("Approved", {
            description: "The requested action has been applied.",
          });
          router.refresh();
        } else {
          toast.error("Approval did not complete", { description: r.error });
        }
      } catch (e) {
        toast.error("Something went wrong", {
          description: e instanceof Error ? e.message : "Please try again.",
        });
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const runDeny = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const r = await denyAgentApproval(id);
        if (r.ok) {
          toast.success("Denied", {
            description: "This request was dismissed without running the action.",
          });
          router.refresh();
        } else {
          toast.error("Could not deny", { description: r.error });
        }
      } catch (e) {
        toast.error("Something went wrong", {
          description: e instanceof Error ? e.message : "Please try again.",
        });
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  return (
    <ul className="space-y-2">
      {approvals.map((approval) => {
        const targetLine = formatApprovalTargetLine(approval.target_type, approval.target_id);
        const busy = busyId === approval.id;
        const stale = emphasizeQueueAge && isApprovalPendingStale(approval.created_at);
        const reminderAudit = emphasizeQueueAge
          ? parseStaleReminderAudit(approval.evidence as Record<string, unknown>)
          : null;
        const ageLabel = emphasizeQueueAge
          ? formatApprovalShortRelativeAge(approval.created_at)
          : formatApprovalRelativeTime(approval.created_at);
        return (
          <li
            key={approval.id}
            className={cn(
              "rounded-lg border bg-card/30 dark:bg-white/[0.02]",
              stale
                ? "border-amber-500/25 dark:border-amber-400/18"
                : "border-border/80 dark:border-white/[0.06]",
            )}
          >
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <h3 className="font-[family-name:var(--font-inter)] text-[0.8125rem] font-semibold leading-snug text-foreground">
                    {approval.title}
                  </h3>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {stale ? (
                      <Badge
                        variant="outline"
                        className="border-border/80 bg-muted/25 font-[family-name:var(--font-inter)] text-[0.58rem] font-medium normal-case tracking-normal text-muted-foreground dark:border-white/[0.1]"
                      >
                        {MVP_TERMS.aging}
                      </Badge>
                    ) : null}
                    <time
                      className={cn(
                        "font-[family-name:var(--font-inter)] text-[0.65rem] tabular-nums",
                        stale
                          ? "text-amber-950/80 dark:text-amber-100/75"
                          : "text-muted-foreground",
                      )}
                      dateTime={approval.created_at}
                      title={formatApprovalAbsoluteTime(approval.created_at)}
                    >
                      {ageLabel}
                    </time>
                  </div>
                </div>
                {approval.summary ? (
                  <p className="font-[family-name:var(--font-inter)] text-[0.75rem] leading-relaxed text-muted-foreground">
                    {approval.summary}
                  </p>
                ) : null}
                {reminderAudit ? (
                  <p className="font-[family-name:var(--font-inter)] text-[0.65rem] leading-snug text-muted-foreground/85">
                    {MVP_TERMS.reminded}{" "}
                    <time dateTime={reminderAudit.last_sent_at} title={formatApprovalAbsoluteTime(reminderAudit.last_sent_at)}>
                      {formatApprovalShortRelativeAge(reminderAudit.last_sent_at)}
                    </time>
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-amber-500/35 bg-amber-500/[0.08] font-[family-name:var(--font-inter)] text-[0.6rem] font-medium uppercase tracking-[0.06em] text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100"
                  >
                    {formatApprovalActionType(approval.action_type)}
                  </Badge>
                  <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-muted-foreground">
                    {formatApprovalAgentType(approval.agent_type)}
                  </span>
                  {targetLine ? (
                    <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-muted-foreground">
                      {targetLine}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                <ApprovalAuditSheetTrigger approval={approval} className="border-border/80 dark:border-white/[0.1]" />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  className={cn(
                    "font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.1em]",
                    "border border-[#BD9952]/40 bg-[#BD9952]/15 text-[#1f1608] hover:bg-[#BD9952]/25",
                    "dark:border-[#BD9952]/35 dark:bg-[#BD9952]/10 dark:text-[#e8dcc8] dark:hover:bg-[#BD9952]/20",
                  )}
                  onClick={() => void runApprove(approval.id)}
                >
                  {busy ? "…" : "Approve"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className="font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-[0.1em]"
                  onClick={() => void runDeny(approval.id)}
                >
                  {busy ? "…" : "Deny"}
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
