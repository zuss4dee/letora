import { formatApprovalShortRelativeAge } from "@/components/dashboard/approval-display";
import { MVP_TERMS } from "@/components/dashboard/workspace-terminology";
import type { ApprovalQueueStats } from "@/lib/approvals/queue-stats";

const ONBOARDING = "send_onboarding_email" as const;
const RENT_CHASE = "send_rent_chase_email" as const;
const MOVE_IN = "send_move_in_email" as const;
const MAINT = "approve_maintenance_dispatch" as const;

function statBlock(label: string, value: number, valueClass?: string) {
  return (
    <div className="min-w-0 border border-white/[0.07] bg-[#151515] px-3 py-2.5">
      <p className="font-headline text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p
        className={`mt-1 font-headline text-lg font-light tabular-nums text-zinc-100 md:text-xl ${valueClass ?? ""}`}
      >
        {value}
      </p>
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
    <section aria-label="Approval queue summary" className="space-y-2">
      <p className="font-headline text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        Queue health
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {statBlock("Pending", stats.pendingTotal)}
        {statBlock("Onboarding", onboarding)}
        {statBlock("Rent chase", rent)}
        {statBlock("Move-in", moveIn)}
        {statBlock("Maintenance", maintenance)}
        <div className="min-w-0 border border-white/[0.07] bg-[#151515] px-3 py-2.5">
          <p className="font-headline text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Oldest waiting
          </p>
          <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.8125rem] font-medium tabular-nums text-zinc-200">
            {oldest ?? "—"}
          </p>
        </div>
        <div className="min-w-0 border border-white/[0.07] bg-[#151515] px-3 py-2.5">
          <p className="font-headline text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {MVP_TERMS.aging}
          </p>
          <p
            className={`mt-1 font-headline text-lg font-light tabular-nums md:text-xl ${
              stats.stalePendingCount > 0 ? "text-rose-300" : "text-zinc-100"
            }`}
          >
            {stats.stalePendingCount}
          </p>
          <p className="mt-0.5 font-[family-name:var(--font-inter)] text-[0.65rem] leading-snug text-zinc-500">
            Over 48h pending
          </p>
        </div>
      </div>
    </section>
  );
}
