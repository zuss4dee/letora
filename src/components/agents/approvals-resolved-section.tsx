import { ApprovalAuditSheetTrigger } from "@/components/agents/approval-audit-sheet";
import {
  formatApprovalAbsoluteTime,
  formatApprovalActionType,
  formatApprovalDecisionStatus,
  formatApprovalTargetLine,
} from "@/components/dashboard/approval-display";
import type { AgentApprovalRow } from "@/lib/approvals/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "executed":
      return "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/8 dark:text-emerald-100";
    case "denied":
      return "border-border bg-muted/40 text-muted-foreground";
    default:
      return "border-border bg-muted/30 text-foreground/80";
  }
}

export function ApprovalsResolvedSection({
  approvals,
  className,
}: {
  approvals: AgentApprovalRow[];
  className?: string;
}) {
  if (approvals.length === 0) return null;

  return (
    <section className={cn(className)} aria-labelledby="approvals-resolved-heading">
      <h2
        id="approvals-resolved-heading"
        className="font-headline text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-zinc-500"
      >
        Recent decisions
      </h2>
      <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.75rem] text-zinc-400">
        Completed, denied, or approved (newest first).
      </p>
      <ul className="mt-4 divide-y divide-white/[0.06] border border-white/[0.1] bg-[#111111]">
        {approvals.map((a) => {
          const targetLine = formatApprovalTargetLine(a.target_type, a.target_id);
          const decided = a.decided_at ?? a.executed_at ?? a.created_at;
          return (
            <li key={a.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-4">
              <div className="min-w-0 flex-1">
                <p className="font-[family-name:var(--font-inter)] text-[0.75rem] font-medium text-zinc-100">
                  {a.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.05em]", statusBadgeClass(a.status))}>
                    {formatApprovalDecisionStatus(a.status)}
                  </Badge>
                  <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-zinc-400">
                    {formatApprovalActionType(a.action_type)}
                  </span>
                  {targetLine ? (
                    <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-zinc-500">
                      {targetLine}
                    </span>
                  ) : null}
                </div>
                {a.status === "denied" && a.deny_reason ? (
                  <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.65rem] text-zinc-500">
                    {a.deny_reason}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
                <time
                  className="font-[family-name:var(--font-inter)] text-[0.65rem] tabular-nums text-zinc-500 sm:text-right"
                  dateTime={decided}
                  title={formatApprovalAbsoluteTime(decided)}
                >
                  {formatApprovalAbsoluteTime(decided)}
                </time>
                <ApprovalAuditSheetTrigger approval={a} className="border-white/[0.14] text-zinc-300 hover:bg-white/[0.04]" />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
