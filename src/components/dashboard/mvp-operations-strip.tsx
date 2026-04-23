import Link from "next/link";
import { ArrowRight, ClipboardCheck, Inbox, Sparkles, Wrench } from "lucide-react";

import { MVP_TERMS } from "@/components/dashboard/workspace-terminology";
import { cn } from "@/lib/utils";

export type MvpOperationsSnapshot = {
  onboardingRuns7d: number;
  pendingApprovalCount: number;
  maintenanceDispatchPendingCount: number;
  approvalsCompleted7d: number;
};

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 gap-2.5 rounded-lg border border-border/70 bg-card/30 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02] sm:min-w-[7.5rem]">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="font-headline text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-headline text-lg font-extralight tabular-nums text-foreground">{value}</p>
        {hint ? <p className="mt-0.5 font-[family-name:var(--font-inter)] text-[0.65rem] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function MvpOperationsStrip({
  snapshot,
  className,
}: {
  snapshot: MvpOperationsSnapshot;
  className?: string;
}) {
  const quiet =
    snapshot.pendingApprovalCount === 0 &&
    snapshot.maintenanceDispatchPendingCount === 0 &&
    snapshot.onboardingRuns7d === 0 &&
    snapshot.approvalsCompleted7d === 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card/35 px-4 py-4 shadow-sm dark:border-white/[0.06] dark:bg-[#101010]/75",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Today&apos;s operations
          </p>
          <p className="max-w-md font-[family-name:var(--font-inter)] text-[0.8125rem] leading-relaxed text-muted-foreground">
            Onboarding, rent chases, move-in email, and contractor dispatch stay in{" "}
            <span className="text-foreground/90">{MVP_TERMS.pendingApproval.toLowerCase()}</span> until you sign off
            — nothing sensitive sends without you. Letora drafts and checks; you decide.
          </p>
        </div>
        <Link
          href="/dashboard/approvals"
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-border/80 px-3 py-1.5 font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-[#BD9952]/40 hover:bg-[#BD9952]/10 hover:text-foreground dark:border-white/[0.1]"
        >
          {MVP_TERMS.pendingApprovals}
          <ArrowRight className="size-3.5 opacity-70" aria-hidden />
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <MiniStat
          icon={Inbox}
          label={MVP_TERMS.pendingApprovals}
          value={snapshot.pendingApprovalCount}
          hint={snapshot.pendingApprovalCount ? "Review now" : "Nothing waiting"}
        />
        <MiniStat
          icon={Wrench}
          label="Maintenance dispatch"
          value={snapshot.maintenanceDispatchPendingCount}
          hint={snapshot.maintenanceDispatchPendingCount ? "Contractor email gated" : "—"}
        />
        <MiniStat
          icon={Sparkles}
          label="Onboarding runs"
          value={snapshot.onboardingRuns7d}
          hint="Started (7 days)"
        />
        <MiniStat
          icon={ClipboardCheck}
          label={MVP_TERMS.completed}
          value={snapshot.approvalsCompleted7d}
          hint="Approvals finished (7 days)"
        />
      </div>

      {quiet ? (
        <p className="mt-4 border-t border-border/50 pt-3 font-[family-name:var(--font-inter)] text-[0.75rem] leading-relaxed text-muted-foreground dark:border-white/[0.06]">
          Fresh workspace — try asking the assistant to{" "}
          <span className="text-foreground/85">start tenant onboarding</span>,{" "}
          <span className="text-foreground/85">check overdue rent</span>, or{" "}
          <span className="text-foreground/85">log maintenance</span>. Anything that emails a tenant or contractor will
          land in {MVP_TERMS.pendingApprovals.toLowerCase()} first.
        </p>
      ) : null}
    </div>
  );
}
