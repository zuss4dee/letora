export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RentTrackerOperationalContextStrip } from "@/components/dashboard/rent-tracker/rent-tracker-operational-context";
import { PropertyPortfolioBackLink } from "@/components/dashboard/property-portfolio-back-link";
import { RentTrackerContent } from "@/components/rent-tracker/rent-tracker-content";
import { getRentPayments } from "@/lib/actions/rent-tracker";
import { computeRentTrackerStats } from "@/lib/rent-tracker-stats";
import { getTenancies } from "@/lib/actions/tenancies";
import { getPendingApprovalsForRentChase } from "@/lib/actions/agent-approvals";
import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";
import type { TenancyRow } from "@/lib/actions/tenancies";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { createClient } from "@/lib/supabase/server";

function parseQueueParam(raw: string | string[] | undefined): string | undefined {
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  return undefined;
}

function scopeRentTrackerData({
  tenancies,
  payments,
  propertyId,
  tenancyId,
  paymentId,
}: {
  tenancies: TenancyRow[];
  payments: RentPaymentListRow[];
  propertyId?: string;
  tenancyId?: string;
  paymentId?: string;
}): {
  scopedTenancies: TenancyRow[];
  scopedPayments: RentPaymentListRow[];
  /** Original `paymentId` query — passed to client to focus listing when present & valid */
  focusPaymentId?: string;
  requestedPaymentMissing: boolean;
  requestedTenancyMissing: boolean;
  usedFullListFallback: boolean;
} {
  const requestedPaymentMissing =
    Boolean(paymentId) && !payments.some((p) => p.id === paymentId);

  const payFromDeepLink =
    paymentId != null ? payments.find((p) => p.id === paymentId) : undefined;

  const requestedTenancyMissing =
    Boolean(tenancyId) &&
    !tenancies.some((t) => t.id === tenancyId) &&
    payFromDeepLink == null;

  const scopeTenancyId =
    payFromDeepLink?.tenancyId ?? (requestedTenancyMissing ? undefined : tenancyId);

  let scopedTenancies = tenancies;
  if (propertyId != null) {
    scopedTenancies = scopedTenancies.filter((t) => t.propertyId === propertyId);
  }
  if (scopeTenancyId != null) {
    scopedTenancies = scopedTenancies.filter((t) => t.id === scopeTenancyId);
  }

  const tenancySet = new Set(scopedTenancies.map((t) => t.id));
  let scopedPayments = payments.filter((p) => p.tenancyId != null && tenancySet.has(p.tenancyId));

  if (paymentId != null && payFromDeepLink && !scopedPayments.some((p) => p.id === paymentId)) {
    scopedPayments = [...scopedPayments, payFromDeepLink];
    const t = tenancies.find((x) => x.id === payFromDeepLink.tenancyId);
    if (t && !scopedTenancies.some((s) => s.id === t.id)) {
      scopedTenancies = [...scopedTenancies, t];
    }
  }

  let usedFullListFallback = false;

  if (
    scopedPayments.length === 0 &&
    (paymentId != null || tenancyId != null) &&
    payments.length > 0
  ) {
    usedFullListFallback = true;
    if (propertyId != null) {
      scopedTenancies = tenancies.filter((t) => t.propertyId === propertyId);
      const pidSet = new Set(scopedTenancies.map((t) => t.id));
      scopedPayments = payments.filter((p) => p.tenancyId != null && pidSet.has(p.tenancyId));
      if (scopedPayments.length === 0) {
        scopedTenancies = tenancies;
        scopedPayments = payments;
      }
    } else {
      scopedTenancies = tenancies;
      scopedPayments = payments;
    }
  }

  return {
    scopedTenancies,
    scopedPayments,
    focusPaymentId: paymentId,
    requestedPaymentMissing,
    requestedTenancyMissing,
    usedFullListFallback,
  };
}

export default async function RentTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; tenancyId?: string; paymentId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  if (!userId) notFound();

  const sp = await searchParams;
  const propertyId = parseQueueParam(sp.propertyId);
  const tenancyId = parseQueueParam(sp.tenancyId);
  const paymentId = parseQueueParam(sp.paymentId);

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <>
      <DashboardPollRefresh />
      <div className="@container/main flex min-h-0 flex-1 flex-col bg-[#0B0B0B] font-['Inter',system-ui,sans-serif] text-[#e5e2e1]">
        <Suspense fallback={<RentTrackerLoadingShell todayIso={todayIso} />}>
          <RentTrackerAsyncSection
            userId={userId}
            todayIso={todayIso}
            propertyId={propertyId}
            tenancyId={tenancyId}
            paymentId={paymentId}
          />
        </Suspense>
      </div>
    </>
  );
}

async function RentTrackerAsyncSection({
  userId,
  todayIso,
  propertyId,
  tenancyId,
  paymentId,
}: {
  userId: string;
  todayIso: string;
  propertyId?: string;
  tenancyId?: string;
  paymentId?: string;
}) {
  const [payments, tenancies, pendingApprovals] = await Promise.all([
    getRentPayments(),
    getTenancies(userId),
    getPendingApprovalsForRentChase(),
  ]);
  const {
    scopedPayments,
    focusPaymentId,
    requestedPaymentMissing,
    requestedTenancyMissing,
    usedFullListFallback,
  } = scopeRentTrackerData({
    tenancies,
    payments,
    propertyId,
    tenancyId,
    paymentId,
  });
  const stats = computeRentTrackerStats(scopedPayments, todayIso, scopedTenancies);
  const showQueueBacktrail = Boolean(paymentId ?? tenancyId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RentTrackerOperationalContextStrip
        showQueueBacktrail={showQueueBacktrail}
        requestedPaymentMissing={requestedPaymentMissing}
        requestedTenancyMissing={requestedTenancyMissing}
        usedFullListFallback={usedFullListFallback}
      />
      {propertyId ? (
        <div className="shrink-0 border-b border-[#282828] bg-[#141414] px-4 py-2 md:px-6">
          <PropertyPortfolioBackLink propertyId={propertyId} className="text-[#868686] hover:text-zinc-400" />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-32 md:pt-6">
        <RentTrackerContent
          payments={scopedPayments}
          stats={stats}
          todayIso={todayIso}
          pendingApprovals={pendingApprovals}
          focusPaymentId={focusPaymentId}
        />
      </div>
    </div>
  );
}

function RentTrackerLoadingShell({ todayIso }: { todayIso: string }) {
  return (
    <div className="relative flex min-h-[50vh] min-w-0 flex-1 flex-col overflow-hidden bg-[#0B0B0B] font-['Inter',system-ui,sans-serif] text-[#e6e3e1]">
      <div className="border-b border-[#282828] bg-[#141414] px-4 py-5 md:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#868686]">
          Rent tracker / {todayIso}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">Rent operations</h1>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-[#282828] bg-[#282828] sm:grid-cols-3 lg:grid-cols-5">
        {["Expected", "Collected", "Outstanding", "Arrears", "Next"].map((label) => (
          <div key={label} className="bg-[#161616] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#6f6f6f]">{label}</p>
            <div className="mt-2 h-7 w-28 animate-pulse rounded-sm bg-[#242424]" />
          </div>
        ))}
      </div>

      <div className="flex-1 bg-[#0B0B0B] p-4 md:p-6">
        <div className="mb-4 h-10 animate-pulse rounded-sm border border-[#333333] bg-[#161616]" />
        <div className="overflow-hidden border border-[#333333] bg-[#161616]">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse border-b border-[#282828] bg-[#161616] last:border-b-0"
            />
          ))}
        </div>
      </div>
    </div>
  );
}