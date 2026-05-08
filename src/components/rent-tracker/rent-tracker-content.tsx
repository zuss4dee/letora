"use client";

import { RentTrackerCheckoutReturnBanner } from "@/components/dashboard/rent-tracker/rent-tracker-checkout-return-banner";
import { RentTrackerRegistry } from "@/components/rent-tracker/rent-tracker-registry";
import type { LateRentChaseUiState } from "@/lib/dashboard/late-rent-chase-status";
import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";
import type { RentTrackerSummaryStats } from "@/lib/rent-tracker-stats";
import type { AgentApprovalRow } from "@/lib/approvals/types";
import type { RentTrackerResolvedDisplayMode } from "@/lib/rent-tracker-url-mode";

export function RentTrackerContent({
  payments,
  stats,
  todayIso,
  pendingApprovals,
  focusPaymentId,
  canonicalRentTrackerMode,
  rentTrackerPreserveHref,
  chaseStatusByPaymentId,
  onMarkPaidSuccess,
}: {
  payments: RentPaymentListRow[];
  stats: RentTrackerSummaryStats;
  todayIso: string;
  pendingApprovals: AgentApprovalRow[];
  focusPaymentId?: string;
  canonicalRentTrackerMode: RentTrackerResolvedDisplayMode;
  /** Same pathname & id params without `mode` — used for “Exit filtered view”. */
  rentTrackerPreserveHref: string;
  chaseStatusByPaymentId: Record<string, LateRentChaseUiState>;
  onMarkPaidSuccess?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0">
        <RentTrackerCheckoutReturnBanner />
      </div>
      <RentTrackerRegistry
        payments={payments}
        stats={stats}
        todayIso={todayIso}
        pendingApprovals={pendingApprovals}
        focusPaymentId={focusPaymentId}
        canonicalRentTrackerMode={canonicalRentTrackerMode}
        rentTrackerPreserveHref={rentTrackerPreserveHref}
        chaseStatusByPaymentId={chaseStatusByPaymentId}
        onMarkPaidSuccess={onMarkPaidSuccess}
      />
    </div>
  );
}
