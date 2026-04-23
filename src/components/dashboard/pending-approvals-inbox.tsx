import Link from "next/link";
import { Inbox } from "lucide-react";

import {
  formatApprovalAbsoluteTime,
  formatApprovalActionType,
  formatApprovalShortRelativeAge,
  formatApprovalTargetLine,
  isApprovalPendingStale,
} from "@/components/dashboard/approval-display";
import type { ApprovalQueueStats } from "@/lib/approvals/queue-stats";
import { MVP_TERMS } from "@/components/dashboard/workspace-terminology";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PendingApprovalInboxItem = {
  id: string;
  title: string;
  summary: string | null;
  action_type: string;
  created_at: string;
  target_type: string | null;
  target_id: string | null;
};

export function PendingApprovalsInbox({
  total,
  items,
  className,
  queueStats,
}: {
  total: number;
  items: PendingApprovalInboxItem[];
  className?: string;
  /** When set, shows a compact queue-health line under the inbox title (home dashboard). */
  queueStats?: ApprovalQueueStats | null;
}) {
  return (
    <div
      className={cn(
        "mt-4 rounded-xl border border-border/80 bg-card/40 shadow-sm dark:border-white/[0.06] dark:bg-[#101010]/80",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-white/[0.06]">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40 dark:border-white/[0.08] dark:bg-muted/20">
            <Inbox className="size-4 text-muted-foreground" aria-hidden />
          </span>
          <div>
            <p className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Approvals inbox
            </p>
            <p className="mt-0.5 font-[family-name:var(--font-inter)] text-sm font-medium text-foreground">
              {total === 0
                ? `No ${MVP_TERMS.pendingApprovals.toLowerCase()}`
                : `${total} ${total === 1 ? MVP_TERMS.pendingApproval.toLowerCase() : MVP_TERMS.pendingApprovals.toLowerCase()}`}
            </p>
            {total > 0 && queueStats ? (
              <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.7rem] leading-snug text-muted-foreground">
                Onboarding {queueStats.byActionType.send_onboarding_email ?? 0}
                <span className="text-border dark:text-white/15" aria-hidden>
                  {" "}
                  ·{" "}
                </span>
                Rent chase {queueStats.byActionType.send_rent_chase_email ?? 0}
                <span className="text-border dark:text-white/15" aria-hidden>
                  {" "}
                  ·{" "}
                </span>
                Move-in {queueStats.byActionType.send_move_in_email ?? 0}
                <span className="text-border dark:text-white/15" aria-hidden>
                  {" "}
                  ·{" "}
                </span>
                Maintenance {queueStats.byActionType.approve_maintenance_dispatch ?? 0}
                {queueStats.oldestPendingCreatedAt ? (
                  <>
                    <span className="text-border dark:text-white/15" aria-hidden>
                      {" "}
                      ·{" "}
                    </span>
                    Oldest {formatApprovalShortRelativeAge(queueStats.oldestPendingCreatedAt)}
                  </>
                ) : null}
                {queueStats.stalePendingCount > 0 ? (
                  <>
                    <span className="text-border dark:text-white/15" aria-hidden>
                      {" "}
                      ·{" "}
                    </span>
                    <span className="text-amber-950/75 dark:text-amber-100/70">
                      {queueStats.stalePendingCount} {MVP_TERMS.aging.toLowerCase()}
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 border-border font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-[0.12em] dark:border-white/[0.1]"
          asChild
        >
          <Link href="/dashboard/approvals">Review approvals</Link>
        </Button>
      </div>

      {total === 0 ? (
        <div className="space-y-2 px-4 py-4 sm:px-5">
          <p className="font-[family-name:var(--font-inter)] text-[0.8125rem] leading-relaxed text-muted-foreground">
            Nothing in {MVP_TERMS.pendingApprovals.toLowerCase()} yet. When the assistant proposes a tenant email or a
            contractor dispatch, it appears here first — you approve, then it&apos;s {MVP_TERMS.sent.toLowerCase()}.
          </p>
          <p className="font-[family-name:var(--font-inter)] text-[0.75rem] leading-relaxed text-muted-foreground/90">
            Try: &ldquo;Start onboarding for [tenant]&rdquo;, &ldquo;Who is overdue on rent?&rdquo;, or &ldquo;Log a
            maintenance issue&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 dark:divide-white/[0.06]">
            {items.map((a) => {
            const targetLine = formatApprovalTargetLine(a.target_type, a.target_id);
            return (
              <li key={a.id}>
                <Link
                  href="/dashboard/approvals"
                  className="block px-4 py-3 transition-colors hover:bg-muted/40 dark:hover:bg-white/[0.03] sm:px-5"
                  aria-label={`Open approvals: ${a.title}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 font-[family-name:var(--font-inter)] text-[0.8125rem] font-medium text-foreground">
                      {a.title}
                    </p>
                    <time
                      className={cn(
                        "shrink-0 font-[family-name:var(--font-inter)] text-[0.6875rem] tabular-nums",
                        isApprovalPendingStale(a.created_at)
                          ? "text-amber-950/75 dark:text-amber-100/70"
                          : "text-muted-foreground",
                      )}
                      dateTime={a.created_at}
                      title={formatApprovalAbsoluteTime(a.created_at)}
                    >
                      {formatApprovalShortRelativeAge(a.created_at)}
                    </time>
                  </div>
                  {a.summary ? (
                    <p className="mt-1 line-clamp-2 font-[family-name:var(--font-inter)] text-[0.75rem] leading-snug text-muted-foreground">
                      {a.summary}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-2 py-0.5 font-[family-name:var(--font-inter)] text-[0.625rem] font-medium uppercase tracking-[0.08em] text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                      {formatApprovalActionType(a.action_type)}
                    </span>
                    {targetLine ? (
                      <span className="font-[family-name:var(--font-inter)] text-[0.625rem] text-muted-foreground">
                        {targetLine}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {total > items.length ? (
        <p className="border-t border-border/60 px-4 py-2.5 dark:border-white/[0.06] sm:px-5">
          <Link
            href="/dashboard/approvals"
            className="font-[family-name:var(--font-inter)] text-[0.75rem] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            +{total - items.length} more in inbox
          </Link>
        </p>
      ) : null}
    </div>
  );
}
