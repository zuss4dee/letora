import Link from "next/link";

import { CommandCenterKpiGridClient } from "@/components/dashboard/command-center/command-center-kpi-grid-client";
import type { CommandCenterKpisLoadResult } from "@/lib/dashboard/command-center-queries";

export function CommandCenterKpiGridSkeleton() {
  return (
    <div className="mb-8 grid grid-cols-2 gap-px border border-[#333333] bg-[#333333] md:grid-cols-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex min-h-[88px] flex-col bg-[#161616] p-4 last:col-span-full md:last:col-span-2">
          <div className="mb-2 h-2 w-24 animate-pulse rounded bg-zinc-700" />
          <div className="h-8 w-16 animate-pulse rounded bg-zinc-700" />
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

export function CommandCenterActionBar() {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-['Inter',sans-serif] text-xl font-semibold tracking-tight text-white md:text-2xl">
          Command Center
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
          Live portfolio snapshot
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/approvals"
          className="border border-[#333333] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition-colors hover:bg-[#161616]"
        >
          Open Approvals
        </Link>
        <Link
          href="/dashboard/properties"
          className="border border-[#333333] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition-colors hover:bg-[#161616]"
        >
          View Portfolio
        </Link>
        <Link
          href="/dashboard/import"
          className="bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-zinc-200"
        >
          Import Portfolio
        </Link>
      </div>
    </div>
  );
}
