import { formatApprovalShortRelativeAge } from "@/components/dashboard/approval-display";
import type { ApprovalQueueStats } from "@/lib/approvals/queue-stats";
import { cn } from "@/lib/utils";

const ONBOARDING = "send_onboarding_email" as const;
const RENT_CHASE = "send_rent_chase_email" as const;
const MOVE_IN = "send_move_in_email" as const;
const MAINT = "approve_maintenance_dispatch" as const;

function statBlock(label: string, value: number, isAging?: boolean) {
  return (
    <div className="flex flex-col border border-zinc-200/90 bg-white p-4 dark:border-[#232323] dark:bg-[#111111]">
      <span className="mb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={cn(
        "text-xl font-bold tabular-nums",
        isAging && value > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-white"
      )}>
        {value}
      </span>
    </div>
  );
}

export function ApprovalsQueueSummary({ stats }: { stats: ApprovalQueueStats }) {
  const onboarding = stats.byActionType[ONBOARDING] ?? 0;
  const rent = stats.byActionType[RENT_CHASE] ?? 0;
  const moveIn = stats.byActionType[MOVE_IN] ?? 0;
  const maintenance = stats.byActionType[MAINT] ?? 0;
  const oldest =
    stats.oldestPendingCreatedAt != null ? formatApprovalShortRelativeAge(stats.oldestPendingCreatedAt) : null;

  return (
    <div className="grid grid-cols-1 gap-px border border-zinc-200/90 bg-zinc-200/90 sm:grid-cols-3 lg:grid-cols-7 dark:border-[#333333] dark:bg-[#333333]">
      {statBlock("Pending", stats.pendingTotal)}
      {statBlock("Onboarding", onboarding)}
      {statBlock("Rent Chase", rent)}
      {statBlock("Move-In", moveIn)}
      {statBlock("Maintenance", maintenance)}
      <div className="flex flex-col bg-white p-4 dark:bg-[#111111]">
        <span className="mb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-500">Oldest Waiting</span>
        <span className="text-[14px] font-bold text-zinc-800 dark:text-zinc-200">{oldest ?? "—"}</span>
      </div>
      {statBlock("Aging (>48h)", stats.stalePendingCount, true)}
    </div>
  );
}
