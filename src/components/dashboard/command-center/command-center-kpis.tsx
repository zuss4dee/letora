import Link from "next/link";

import { loadCommandCenterKpis } from "@/lib/dashboard/command-center-queries";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(
    Math.max(0, n),
  );
}

export function CommandCenterKpiGridSkeleton() {
  return (
    <div className="mb-8 grid grid-cols-1 gap-px border border-[#333333] bg-[#333333] md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col bg-[#161616] p-4">
          <div className="mb-2 h-2 w-24 animate-pulse rounded bg-zinc-700" />
          <div className="h-8 w-12 animate-pulse rounded bg-zinc-700" />
        </div>
      ))}
    </div>
  );
}

export async function CommandCenterKpis({ userId }: { userId: string }) {
  const k = await loadCommandCenterKpis(userId);

  return (
    <div className="mb-8 grid grid-cols-1 gap-px border border-[#333333] bg-[#333333] md:grid-cols-5">
      <div className="flex flex-col bg-[#161616] p-4">
        <span className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pending Approvals</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tabular-nums">{k.pendingApprovals}</span>
          <span className="font-mono text-[10px] uppercase text-zinc-600">Queue</span>
        </div>
      </div>
      <div className="flex flex-col bg-[#161616] p-4">
        <span className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Overdue Rent</span>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              k.overdueRentTotal > 0 ? "text-[#ffb4ab]" : "text-white",
            )}
          >
            {formatMoney(k.overdueRentTotal)}
          </span>
        </div>
      </div>
      <div className="flex flex-col border-[#333333] bg-[#161616] p-4 md:border-l">
        <span className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Maintenance</span>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold text-white tabular-nums">{k.maintenanceOpen}</span>
          {k.maintenanceHighPriority > 0 ? (
            <span className="bg-[#93000a] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#ffdad6]">
              High Priority
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col bg-[#161616] p-4">
        <span className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Compliance Gaps</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tabular-nums">{k.complianceGaps}</span>
          <span className="font-mono text-[10px] uppercase text-zinc-600">Renewals</span>
        </div>
      </div>
      <div className="flex flex-col bg-[#161616] p-4">
        <span className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Active Onboarding</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tabular-nums">{k.activeOnboarding}</span>
          <span className="font-mono text-[10px] uppercase text-zinc-600">Tenants</span>
        </div>
      </div>
    </div>
  );
}

export function CommandCenterActionBar() {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-['Inter',sans-serif] text-xl font-semibold tracking-tight text-white md:text-2xl">
          Portfolio Overview
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
          LTD-GLOBAL-NODE-04 // LIVE STATUS
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
          href="/dashboard/compliance"
          className="border border-[#333333] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition-colors hover:bg-[#161616]"
        >
          Open Compliance
        </Link>
        <Link
          href="/dashboard/properties"
          className="bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-zinc-200"
        >
          View Portfolio
        </Link>
      </div>
    </div>
  );
}
