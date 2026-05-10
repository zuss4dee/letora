import { ApprovalAuditSheetTrigger } from "@/components/agents/approval-audit-sheet";
import {
  formatApprovalAbsoluteTime,
  formatApprovalActionType,
  formatApprovalDecisionStatus,
  formatApprovalTargetLine,
} from "@/components/dashboard/approval-display";
import type { AgentApprovalRow } from "@/lib/approvals/types";
import { cn } from "@/lib/utils";

export function ApprovalsResolvedSection({
  approvals,
  className,
}: {
  approvals: AgentApprovalRow[];
  className?: string;
}) {
  if (approvals.length === 0) return null;

  return (
    <section className={cn(className)}>
      <ul className="divide-y divide-zinc-200 border border-zinc-200 bg-white dark:divide-[#232323] dark:border-[#232323] dark:bg-[#0e0e0e]">
        {approvals.map((a) => {
          const targetLine = formatApprovalTargetLine(a.target_type, a.target_id);
          const decided = a.decided_at ?? a.executed_at ?? a.created_at;
          const isDenied = a.status === "denied";
          const isExecuted = a.status === "executed";
          const isApprovedInFlight = a.status === "approved";
          const isExpired = a.status === "expired";
          
          return (
            <li key={a.id} className="grid grid-cols-12 items-center gap-4 px-4 py-3">
              <div className="col-span-5 min-w-0">
                <p className="truncate text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                  {a.title}
                </p>
                <p className="truncate text-[10px] uppercase tracking-tight text-zinc-600 dark:text-zinc-500">
                  {targetLine ?? "System"}
                </p>
              </div>
              <div className="col-span-2">
                <span
                  className={cn(
                    "inline-block border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                    isExecuted && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                    isApprovedInFlight && "border-amber-500/35 bg-amber-500/10 text-amber-400",
                    isExpired && "border-zinc-600 bg-zinc-800/50 text-zinc-400",
                    isDenied && "border-rose-500/30 bg-rose-500/10 text-rose-400",
                    !isExecuted && !isApprovedInFlight && !isExpired && !isDenied && "border-[#333333] bg-transparent text-zinc-500",
                  )}
                >
                  {formatApprovalDecisionStatus(a.status)}
                </span>
              </div>
              <div className="col-span-3 text-[11px] text-zinc-600 dark:text-zinc-500">
                {formatApprovalActionType(a.action_type)}
              </div>
              <div className="col-span-2 flex justify-end gap-3">
                <time
                  className="text-right text-[10px] tabular-nums text-zinc-500 dark:text-zinc-600"
                  dateTime={decided}
                >
                  {formatApprovalAbsoluteTime(decided).split(',')[0]}
                </time>
                <ApprovalAuditSheetTrigger 
                  approval={a} 
                  className="size-5 border-zinc-300 p-0 text-[10px] text-zinc-500 hover:bg-zinc-100 dark:border-[#333333] dark:text-zinc-400 dark:hover:bg-zinc-900" 
                />
              </div>
              {isDenied && a.deny_reason && (
                <div className="col-span-12 mt-1 border-l border-rose-900/50 pl-2 text-[10px] text-rose-300/60">
                  Reason: {a.deny_reason}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
