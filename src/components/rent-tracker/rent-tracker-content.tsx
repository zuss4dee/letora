"use client";

import { RentTrackerRegistry } from "@/components/rent-tracker/rent-tracker-registry";
import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";
import type { RentTrackerSummaryStats } from "@/lib/rent-tracker-stats";
import type { AgentApprovalRow } from "@/lib/approvals/types";

export function RentTrackerContent({
  payments,
  stats,
  todayIso,
  pendingApprovals,
  focusPaymentId,
}: {
  payments: RentPaymentListRow[];
  stats: RentTrackerSummaryStats;
  todayIso: string;
  pendingApprovals: AgentApprovalRow[];
  focusPaymentId?: string;
}) {
  return (
    <RentTrackerRegistry
      payments={payments}
      stats={stats}
      todayIso={todayIso}
      pendingApprovals={pendingApprovals}
      focusPaymentId={focusPaymentId}
    />
  );
}
