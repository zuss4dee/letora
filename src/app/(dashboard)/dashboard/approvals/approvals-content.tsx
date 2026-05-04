import { cache } from "react";

import { getPendingAgentApprovals, getRecentResolvedAgentApprovals } from "@/lib/actions/agent-approvals";
import { ApprovalsPageWorkspace } from "@/components/agents/approvals-page-workspace";
import { ApprovalsQueueSummary } from "@/components/agents/approvals-queue-summary";
import { computeApprovalQueueStats } from "@/lib/approvals/queue-stats";
import { Skeleton } from "@/components/ui/skeleton";

const getApprovalsData = cache(async () => {
  const [pending, resolved] = await Promise.all([
    getPendingAgentApprovals(),
    getRecentResolvedAgentApprovals(12),
  ]);

  return {
    pending,
    resolved,
    queueStats: computeApprovalQueueStats(pending),
  };
});

export function ApprovalsStaticShell() {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Operational Console // Approvals
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Approvals Queue
          </h1>
          <p className="max-w-2xl text-[13px] text-zinc-400">
            Review and execute agent-prepared actions. High-priority decisions are surfaced here for final landlord verification before deployment.
          </p>
        </div>
      </div>
    </header>
  );
}

export async function ApprovalsQueueHealthSection() {
  const { queueStats } = await getApprovalsData();

  return (
    <section className="-mt-2">
      <ApprovalsQueueSummary stats={queueStats} />
    </section>
  );
}

export async function ApprovalsWorkspaceSection() {
  const { pending, resolved, queueStats } = await getApprovalsData();

  return (
    <section aria-label="Approvals workspace">
      <h2 className="sr-only">Approval queue and recent decisions</h2>
      <ApprovalsPageWorkspace
        pending={pending}
        resolved={resolved}
        pendingByActionType={queueStats.byActionType}
      />
    </section>
  );
}

export function ApprovalsQueueSummarySkeleton() {
  return (
    <section className="-mt-2 space-y-2">
      <Skeleton className="h-3.5 w-28 rounded-sm bg-zinc-800/70" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.25rem] w-full rounded-none bg-zinc-900/70" />
        ))}
      </div>
    </section>
  );
}

export function ApprovalsWorkspaceSkeleton() {
  return (
    <section aria-label="Loading approvals workspace" className="space-y-3">
      <Skeleton className="h-12 w-full rounded-none bg-zinc-900/70" />
      <div className="grid gap-0 border border-white/[0.1] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-2 border-b border-white/[0.08] p-3 lg:border-b-0 lg:border-r lg:border-white/[0.08]">
          <Skeleton className="h-9 w-full rounded-none bg-zinc-900/70" />
          <Skeleton className="h-9 w-full rounded-none bg-zinc-900/70" />
          <Skeleton className="h-9 w-full rounded-none bg-zinc-900/70" />
          <Skeleton className="h-9 w-full rounded-none bg-zinc-900/70" />
        </div>
        <div className="space-y-3 p-4">
          <Skeleton className="h-4 w-28 rounded-none bg-zinc-800/70" />
          <Skeleton className="h-14 w-full rounded-none bg-zinc-900/70" />
          <Skeleton className="h-16 w-full rounded-none bg-zinc-900/70" />
          <Skeleton className="h-9 w-full rounded-none bg-zinc-900/70" />
        </div>
      </div>
    </section>
  );
}
