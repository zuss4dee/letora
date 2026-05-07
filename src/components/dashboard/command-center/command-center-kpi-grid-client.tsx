"use client";

import { AlertTriangle, CircleHelp } from "lucide-react";
import Link from "next/link";

import type { CommandCenterKpis } from "@/lib/dashboard/command-center-queries";
import type { RentTrackerDisplayMode } from "@/lib/rent-tracker-url-mode";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

function rentTrackerHref(mode: RentTrackerDisplayMode) {
  const p = new URLSearchParams();
  p.set("mode", mode);
  return `/dashboard/rent-tracker?${p.toString()}`;
}

const MAINTENANCE_HREF = "/dashboard/maintenance";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(
    Math.max(0, n),
  );
}

type MoneyTileProps = {
  label: string;
  tooltip: string;
  value: number;
  valueClassName?: string;
  href: string;
  tileAriaLabel: string;
  cellClassName?: string;
};

function KpiMoneyTile({ label, tooltip, value, valueClassName, href, tileAriaLabel, cellClassName }: MoneyTileProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-[88px] flex-col bg-[#161616] p-4 transition-colors hover:bg-[#1c1c1c] focus-within:bg-[#1c1c1c]",
        cellClassName,
      )}
    >
      <Link href={href} className="absolute inset-0 z-0 outline-none ring-inset focus-visible:ring-1 focus-visible:ring-zinc-500" aria-label={tileAriaLabel} />
      <div className="relative z-10 mb-2 flex items-start gap-1.5 pointer-events-none">
        <span className="flex-1 text-[9px] font-bold uppercase leading-snug tracking-wider text-zinc-500">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="pointer-events-auto mt-0.5 shrink-0 rounded border border-transparent p-0.5 text-zinc-600 transition-colors hover:border-zinc-700 hover:text-zinc-400"
              aria-label={`What ${label} means`}
            >
              <CircleHelp className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-left text-[11px] leading-snug">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="relative z-10 flex flex-1 flex-col pointer-events-none">
        <span className={cn("text-xl font-bold tabular-nums", valueClassName ?? "text-white")}>{formatMoney(value)}</span>
      </div>
    </div>
  );
}

type MaintTileProps = {
  kpis: CommandCenterKpis;
  cellClassName?: string;
};

function KpiMaintenanceTile({ kpis, cellClassName }: MaintTileProps) {
  const label = "Open Maintenance";
  const tooltip =
    "Count of maintenance_requests tied to your properties via tenancy. ‘High’ badges include priority high or urgent.";
  return (
    <div
      className={cn(
        "relative flex min-h-[88px] flex-col bg-[#161616] p-4 transition-colors hover:bg-[#1c1c1c] focus-within:bg-[#1c1c1c]",
        cellClassName,
      )}
    >
      <Link
        href={MAINTENANCE_HREF}
        className="absolute inset-0 z-0 outline-none ring-inset focus-visible:ring-1 focus-visible:ring-zinc-500"
        aria-label={`Open maintenance workspace, ${kpis.maintenanceOpen} open`}
      />
      <div className="relative z-10 mb-2 flex items-start gap-1.5 pointer-events-none">
        <span className="flex-1 text-[9px] font-bold uppercase leading-snug tracking-wider text-zinc-500">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="pointer-events-auto mt-0.5 shrink-0 rounded border border-transparent p-0.5 text-zinc-600 transition-colors hover:border-zinc-700 hover:text-zinc-400"
              aria-label={`What ${label} means`}
            >
              <CircleHelp className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-left text-[11px] leading-snug">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="relative z-10 flex flex-1 flex-col pointer-events-none">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-bold text-white tabular-nums">{kpis.maintenanceOpen}</span>
          {kpis.maintenanceHighPriority > 0 ? (
            <span className="bg-[#93000a] px-1 py-0.5 text-[8px] font-bold uppercase text-[#ffdad6]">
              {kpis.maintenanceHighPriority} high
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Presentational KPI grid with operator-oriented labels (see product copy alongside loadCommandCenterFinancials). */
export function CommandCenterKpiGridClient({
  kpis,
  kpisDegraded = false,
}: {
  kpis: CommandCenterKpis;
  /** When true, KPI values are the zero fallback (load failed or timed out) — show a lightweight notice. */
  kpisDegraded?: boolean;
}) {
  const router = useRouter();
  return (
    <TooltipProvider delayDuration={180}>
      <div className="mb-8 space-y-3">
        {kpisDegraded ? (
          <div
            role="status"
            aria-live="polite"
            className="flex gap-2.5 rounded-md border border-[#3a3530] bg-[#12110f] px-3 py-2.5 shadow-sm"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#9a8b6a]" aria-hidden />
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#c9b896]">
                Live snapshot unavailable
              </p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                We couldn&apos;t load live KPIs — the figures below aren&apos;t your portfolio data.&nbsp;
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className="text-zinc-400 underline underline-offset-2 hover:text-white"
                >
                  Refresh
                </button>
                {" "}to try again.
              </p>
            </div>
          </div>
        ) : null}
        {/* 12 cols on md: row of four × span-3, row of three × span-4 — no empty cells. Mobile: 2 cols with last tile span-2. */}
        <div className="grid grid-cols-2 gap-px border border-[#333333] bg-[#333333] md:grid-cols-12">
          <KpiMoneyTile
            label="Scheduled · This Month"
            tooltip="Contractual monthly rent for active tenancies (sum of monthly_rent) when the portfolio has a non‑zero rent roll — matches Rent Tracker Expected (Mo). Otherwise sums instalment amounts with due_date in this month. Use it as the month’s rent roll versus cash collected."
            value={kpis.rentScheduledThisMonth}
            valueClassName="text-white"
            href={rentTrackerHref("scheduled_this_month")}
            tileAriaLabel="Open rent tracker: scheduled this month"
            cellClassName="md:col-span-3"
          />
          <KpiMoneyTile
            label="Collected · This Month"
            tooltip='Sum of instalments marked paid whose paid_date is in this month. Paid rows missing paid_date fall back to due_date in this month.'
            value={kpis.rentCollectedThisMonth}
            valueClassName="text-[#afefdd]"
            href={rentTrackerHref("collected_this_month")}
            tileAriaLabel="Open rent tracker: collected this month"
            cellClassName="md:col-span-3"
          />
          <KpiMoneyTile
            label="Still Due · This Month"
            tooltip="Unpaid instalments due in the current calendar month. Older missed payments are rolled into Total unpaid (late), not this tile."
            value={kpis.rentDueThisMonth}
            valueClassName="text-white"
            href={rentTrackerHref("due_this_month")}
            tileAriaLabel="Open rent tracker: still due this month"
            cellClassName="md:col-span-3"
          />
          <KpiMoneyTile
            label="Total Unpaid (Late)"
            tooltip="All unpaid overdue instalments across past months (anything still owed from before today). Distinct from Still due · this month, which only looks at the current month window."
            value={kpis.overdueRentTotal}
            valueClassName={kpis.overdueRentTotal > 0 ? "text-[#ffb4ab]" : "text-white"}
            href={rentTrackerHref("arrears")}
            tileAriaLabel="Open rent tracker: total unpaid late rent"
            cellClassName="md:col-span-3"
          />
          <KpiMoneyTile
            label="Scheduled · Next Month"
            tooltip="Forecast of contractual instalments hitting next calendar month (all statuses), not cash expected."
            value={kpis.rentExpectedNextMonth}
            valueClassName="text-zinc-400"
            href={rentTrackerHref("scheduled_next_month")}
            tileAriaLabel="Open rent tracker: scheduled next month"
            cellClassName="md:col-span-4"
          />
          <KpiMoneyTile
            label="Collected · Last Month"
            tooltip="Totals receipts whose paid_date was in the previous calendar month. Missing paid_date on paid rows can attribute to instalments due last month instead."
            value={kpis.rentCollectedLastMonth}
            valueClassName="text-zinc-400"
            href={rentTrackerHref("collected_last_month")}
            tileAriaLabel="Open rent tracker: collected last month"
            cellClassName="md:col-span-4"
          />
          <KpiMaintenanceTile kpis={kpis} cellClassName="col-span-2 md:col-span-4" />
        </div>
      </div>
    </TooltipProvider>
  );
}
