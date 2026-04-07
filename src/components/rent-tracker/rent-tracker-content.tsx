"use client";

import { RentTrackerRegistry } from "@/components/rent-tracker/rent-tracker-registry";
import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";
import type { RentTrackerSummaryStats } from "@/lib/rent-tracker-stats";
import type { TenancyRow } from "@/lib/actions/tenancies";

export function RentTrackerContent({
  payments,
  stats,
  tenancies,
  todayIso,
}: {
  payments: RentPaymentListRow[];
  stats: RentTrackerSummaryStats;
  tenancies: TenancyRow[];
  todayIso: string;
}) {
  return (
    <RentTrackerRegistry
      payments={payments}
      stats={stats}
      tenancies={tenancies}
      todayIso={todayIso}
    />
  );
}
