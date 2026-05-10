import Link from "next/link";

import { CommandCenterKpiGridClient } from "@/components/dashboard/command-center/command-center-kpi-grid-client";
import type { CommandCenterKpisLoadResult } from "@/lib/dashboard/command-center-queries";
import { cn } from "@/lib/utils";

export function CommandCenterKpiGridSkeleton() {
  return (
    <div className="mb-8 grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 dark:border-[#2a2a2a] dark:bg-[#2a2a2a] md:grid-cols-12">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex min-h-[88px] flex-col bg-white p-4 dark:bg-[#161616]",
            i < 4 ? "md:col-span-3" : i < 6 ? "md:col-span-4" : "col-span-2 md:col-span-4",
          )}
        >
          <div className="mb-2 h-2 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-8 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      ))}
    </div>
  );
}

/**
 * Renders KPI grid from an already-fetched payload (no second server round-trip).
 * Parent should call `loadCommandCenterKpis` once and pass the result.
 */
export function CommandCenterKpisPresentation({ kpiLoad }: { kpiLoad: CommandCenterKpisLoadResult }) {
  return <CommandCenterKpiGridClient kpis={kpiLoad.kpis} kpisDegraded={kpiLoad.kpisDegraded} />;
}

export function CommandCenterActionBar({ pendingApprovalsCount = 0 }: { pendingApprovalsCount?: number }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-['Inter',sans-serif] text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl dark:text-white">
          Command Center
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
          Snapshot of rent, upkeep, and what needs a decision today
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/approvals"
          aria-label={
            pendingApprovalsCount > 0
              ? `Open approvals — ${pendingApprovalsCount} pending`
              : "Open approvals"
          }
          className="inline-flex border border-zinc-200 bg-transparent px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-200 dark:bg-zinc-800/40"
        >
          Open Approvals
        </Link>
        <Link
          href="/dashboard/properties"
          className="inline-flex border border-zinc-200 bg-transparent px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-200 dark:bg-zinc-800/40"
        >
          View Portfolio
        </Link>
        <Link
          href="/dashboard/import"
          className="inline-flex border border-transparent bg-zinc-100 dark:bg-zinc-900 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Import Portfolio
        </Link>
      </div>
    </div>
  );
}
