"use client";

import { CircleHelp } from "lucide-react";

import type { CommandCenterKpis } from "@/lib/dashboard/command-center-queries";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
};

function KpiMoneyTile({ label, tooltip, value, valueClassName }: MoneyTileProps) {
  return (
    <div className="flex min-h-[88px] flex-col bg-[#161616] p-4">
      <div className="mb-2 flex items-start gap-1.5">
        <span className="flex-1 text-[9px] font-bold uppercase leading-snug tracking-wider text-zinc-500">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded border border-transparent p-0.5 text-zinc-600 transition-colors hover:border-zinc-700 hover:text-zinc-400"
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
      <div className="flex flex-1 flex-col">
        <span className={cn("text-xl font-bold tabular-nums", valueClassName ?? "text-white")}>{formatMoney(value)}</span>
      </div>
    </div>
  );
}

type MaintTileProps = {
  kpis: CommandCenterKpis;
};

function KpiMaintenanceTile({ kpis }: MaintTileProps) {
  const label = "Open maintenance";
  const tooltip =
    "Count of maintenance_requests tied to your properties via tenancy. ‘High’ badges include priority high or urgent.";
  return (
    <div className="flex min-h-[88px] flex-col bg-[#161616] p-4 md:col-span-2">
      <div className="mb-2 flex items-start gap-1.5">
        <span className="flex-1 text-[9px] font-bold uppercase leading-snug tracking-wider text-zinc-500">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded border border-transparent p-0.5 text-zinc-600 transition-colors hover:border-zinc-700 hover:text-zinc-400"
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
      <div className="flex flex-1 flex-col">
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
export function CommandCenterKpiGridClient({ kpis }: { kpis: CommandCenterKpis }) {
  return (
    <TooltipProvider delayDuration={180}>
      <div className="mb-8 grid grid-cols-2 gap-px border border-[#333333] bg-[#333333] md:grid-cols-4">
        <KpiMoneyTile
          label="Scheduled · this month"
          tooltip="Totals every rent instalment rows whose contract due_date falls in the current calendar month (any status). Use it as the month's rent roll versus cash collected."
          value={kpis.rentScheduledThisMonth}
          valueClassName="text-white"
        />
        <KpiMoneyTile
          label="Collected · this month"
          tooltip='Sum of instalments marked paid whose paid_date is in this month. Paid rows missing paid_date fall back to due_date in this month.'
          value={kpis.rentCollectedThisMonth}
          valueClassName="text-[#afefdd]"
        />
        <KpiMoneyTile
          label="Still due · this month"
          tooltip='Unpaid instalments with due_date inside the current calendar month. Older missed months stay in Total arrears, not here — by design.'
          value={kpis.rentDueThisMonth}
          valueClassName="text-white"
        />
        <KpiMoneyTile
          label="Total arrears"
          tooltip="Every unpaid overdue instalment: status overdue or pending with due_date before today. This is backlog across months, independent of Still due · this month."
          value={kpis.overdueRentTotal}
          valueClassName={kpis.overdueRentTotal > 0 ? "text-[#ffb4ab]" : "text-white"}
        />
        <KpiMoneyTile
          label="Scheduled · next month"
          tooltip="Forecast of contractual instalments hitting next calendar month (all statuses), not cash expected."
          value={kpis.rentExpectedNextMonth}
          valueClassName="text-zinc-400"
        />
        <KpiMoneyTile
          label="Collected · last month"
          tooltip="Totals receipts whose paid_date was in the previous calendar month. Missing paid_date on paid rows can attribute to instalments due last month instead."
          value={kpis.rentCollectedLastMonth}
          valueClassName="text-zinc-400"
        />
        <KpiMaintenanceTile kpis={kpis} />
      </div>
    </TooltipProvider>
  );
}
