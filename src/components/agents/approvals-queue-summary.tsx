import { formatApprovalShortRelativeAge } from "@/components/dashboard/approval-display";
import { MVP_TERMS } from "@/components/dashboard/workspace-terminology";
import type { ApprovalQueueStats } from "@/lib/approvals/queue-stats";
import { cn } from "@/lib/utils";

const ONBOARDING = "send_onboarding_email" as const;
const RENT_CHASE = "send_rent_chase_email" as const;
const MOVE_IN = "send_move_in_email" as const;
const MAINT = "approve_maintenance_dispatch" as const;

function statBlock(label: string, value: number, isAging?: boolean) {
  return (
    <div className="flex flex-col border border-[#232323] bg-[#111111] p-4">
      <span className="mb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={cn(
        "text-xl font-bold tabular-nums",
        isAging && value > 0 ? "text-rose-400" : "text-white"
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
    <div className="grid grid-cols-1 gap-px border border-[#333333] bg-[#333333] sm:grid-cols-3 lg:grid-cols-7">
      {statBlock("Pending", stats.pendingTotal)}
      {statBlock("Onboarding", onboarding)}
      {statBlock("Rent Chase", rent)}
      {statBlock("Move-In", moveIn)}
      {statBlock("Maintenance", maintenance)}
      <div className="flex flex-col bg-[#111111] p-4">
        <span className="mb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-500">Oldest Waiting</span>
        <span className="text-[14px] font-bold text-zinc-200">{oldest ?? "—"}</span>
      </div>
      {statBlock("Aging (>48h)", stats.stalePendingCount, true)}
    </div>
  );
}
