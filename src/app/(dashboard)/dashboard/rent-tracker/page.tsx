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
import {
  applyRentTrackerDisplayMode,
  parseRentTrackerModeParam,
  type RentTrackerResolvedDisplayMode,
} from "@/lib/rent-tracker-url-mode";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { createClient } from "@/lib/supabase/server";

function parseQueueParam(raw: string | string[] | undefined): string | undefined {
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  return undefined;
}

/**
 * Ledger scoping for deep links (property / tenancy / instalment / tenant).
 * For URL `mode=` filter precedence, see {@link applyRentTrackerDisplayMode} in `@/lib/rent-tracker-url-mode`
 * (modes apply only after this reducer runs).
 */
function scopeRentTrackerData({
  tenancies,
  payments,
  propertyId,
  tenancyId,
  paymentId,
  tenantId,
}: {
  tenancies: TenancyRow[];
  payments: RentPaymentListRow[];
  propertyId?: string;
  tenancyId?: string;
  paymentId?: string;
  tenantId?: string;
}): {
  scopedTenancies: TenancyRow[];
  scopedPayments: RentPaymentListRow[];
  /** Original `paymentId` query — passed to client to focus listing when present & valid */
  focusPaymentId?: string;
  requestedPaymentMissing: boolean;
  requestedTenancyMissing: boolean;
  requestedTenantMissing: boolean;
  paymentTenantContextConflict: boolean;
  tenancyTenantContextConflict: boolean;
  usedFullListFallback: boolean;
} {
  const payFromDeepLink =
    paymentId != null ? payments.find((p) => p.id === paymentId) : undefined;

  const requestedPaymentMissing =
    Boolean(paymentId) && payFromDeepLink == null;

  const tenancyRowFromParam =
    tenancyId != null ? tenancies.find((t) => t.id === tenancyId) : undefined;

  const tenancyOfResolvedPayment =
    payFromDeepLink?.tenancyId != null
      ? tenancies.find((t) => t.id === payFromDeepLink.tenancyId)
      : undefined;

  const requestedTenancyMissing =
    Boolean(tenancyId) && tenancyRowFromParam == null && payFromDeepLink == null;

  const requestedTenantMissing =
    Boolean(tenantId) && !tenancies.some((t) => t.tenantId === tenantId);

  const tenancyTenantContextConflict =
    Boolean(tenantId) &&
    Boolean(tenancyId) &&
    tenancyRowFromParam != null &&
    tenancyRowFromParam.tenantId !== tenantId &&
    payFromDeepLink == null;

  const paymentTenantContextConflict =
    Boolean(tenantId) &&
    Boolean(paymentId) &&
    Boolean(payFromDeepLink) &&
    Boolean(tenancyOfResolvedPayment?.tenantId) &&
    tenancyOfResolvedPayment!.tenantId !== tenantId &&
    !requestedPaymentMissing;

  const applyPropertyFilter = (rows: TenancyRow[]): TenancyRow[] => {
    if (propertyId == null) return rows;
    return rows.filter((t) => t.propertyId === propertyId);
  };

  /** Valid payment id wins: scope + focus that instalment even if tenantId disagrees. */
  if (!requestedPaymentMissing && payFromDeepLink && tenancyOfResolvedPayment) {
    let scopedTenancies = applyPropertyFilter([tenancyOfResolvedPayment]);
    if (scopedTenancies.length === 0) scopedTenancies = [tenancyOfResolvedPayment];

    let scopedPayments = payments.filter((p) => p.tenancyId === tenancyOfResolvedPayment.id);
    if (!scopedPayments.some((p) => p.id === payFromDeepLink.id)) {
      scopedPayments = [...scopedPayments, payFromDeepLink];
    }

    let usedFullListFallback = false;
    if (
      scopedPayments.length === 0 &&
      payments.length > 0 &&
      (paymentId != null || tenancyId != null || tenantId != null)
    ) {
      usedFullListFallback = true;
      if (propertyId != null) {
        scopedTenancies = applyPropertyFilter([...tenancies]);
        const pidSet = new Set(scopedTenancies.map((t) => t.id));
        scopedPayments = payments.filter((p) => p.tenancyId != null && pidSet.has(p.tenancyId));
        if (scopedPayments.length === 0) {
          scopedTenancies = [...tenancies];
          scopedPayments = [...payments];
        }
      } else {
        scopedTenancies = [...tenancies];
        scopedPayments = [...payments];
      }
    }

    return {
      scopedTenancies,
      scopedPayments,
      focusPaymentId: paymentId,
      requestedPaymentMissing,
      requestedTenancyMissing,
      requestedTenantMissing,
      paymentTenantContextConflict,
      tenancyTenantContextConflict: false,
      usedFullListFallback,
    };
  }

  /** tenantId + tenancyId point at different people — safest to widen. */
  if (tenancyTenantContextConflict) {
    return {
      scopedTenancies: [...tenancies],
      scopedPayments: [...payments],
      focusPaymentId: undefined,
      requestedPaymentMissing,
      requestedTenancyMissing,
      requestedTenantMissing,
      paymentTenantContextConflict,
      tenancyTenantContextConflict: true,
      usedFullListFallback: true,
    };
  }

  /** tenantId unknown to this landlord’s rent graph */
  if (requestedTenantMissing) {
    return {
      scopedTenancies: [...tenancies],
      scopedPayments: [...payments],
      focusPaymentId: undefined,
      requestedPaymentMissing,
      requestedTenancyMissing,
      requestedTenantMissing: true,
      paymentTenantContextConflict: false,
      tenancyTenantContextConflict: false,
      usedFullListFallback: true,
    };
  }

  const scopeTenancyId =
    payFromDeepLink?.tenancyId ?? (requestedTenancyMissing ? undefined : tenancyId);

  let scopedTenancies = [...tenancies];

  if (tenantId != null) scopedTenancies = scopedTenancies.filter((t) => t.tenantId === tenantId);

  scopedTenancies = applyPropertyFilter(scopedTenancies);

  if (scopeTenancyId != null) {
    scopedTenancies = scopedTenancies.filter((t) => t.id === scopeTenancyId);
  }

  const tenancySet = new Set(scopedTenancies.map((t) => t.id));
  let scopedPayments = payments.filter((p) => p.tenancyId != null && tenancySet.has(p.tenancyId));

  if (paymentId != null && payFromDeepLink && !scopedPayments.some((p) => p.id === paymentId)) {
    scopedPayments = [...scopedPayments, payFromDeepLink];
    const t = tenancies.find((x) => x.id === payFromDeepLink.tenancyId);
    if (t && !scopedTenancies.some((s) => s.id === t.id)) scopedTenancies = [...scopedTenancies, t];
  }

  let usedFullListFallback = false;

  if (
    scopedPayments.length === 0 &&
    (paymentId != null || tenancyId != null || tenantId != null) &&
    payments.length > 0
  ) {
    usedFullListFallback = true;
    if (propertyId != null) {
      scopedTenancies = tenancies.filter((t) => t.propertyId === propertyId);
      const pidSet = new Set(scopedTenancies.map((t) => t.id));
      scopedPayments = payments.filter((p) => p.tenancyId != null && pidSet.has(p.tenancyId));
      if (scopedPayments.length === 0) {
        scopedTenancies = [...tenancies];
        scopedPayments = [...payments];
      }
    } else {
      scopedTenancies = [...tenancies];
      scopedPayments = [...payments];
    }
  }

  return {
    scopedTenancies,
    scopedPayments,
    focusPaymentId: requestedPaymentMissing ? undefined : paymentId,
    requestedPaymentMissing,
    requestedTenancyMissing,
    requestedTenantMissing: false,
    paymentTenantContextConflict: false,
    tenancyTenantContextConflict: false,
    usedFullListFallback,
  };
}

function buildRentTrackerPreserveQuery(params: {
  propertyId?: string;
  tenancyId?: string;
  paymentId?: string;
  tenantId?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.propertyId) qs.set("propertyId", params.propertyId);
  if (params.tenancyId) qs.set("tenancyId", params.tenancyId);
  if (params.paymentId) qs.set("paymentId", params.paymentId);
  if (params.tenantId) qs.set("tenantId", params.tenantId);
  return qs.toString();
}

export default async function RentTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{
    propertyId?: string;
    tenancyId?: string;
    paymentId?: string;
    tenantId?: string;
    mode?: string;
  }>;
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
  const tenantId = parseQueueParam(sp.tenantId);
  const { canonical: resolvedRentTrackerMode, unknownToken } = parseRentTrackerModeParam(sp.mode);
  const unknownRentTrackerModeDropped = unknownToken !== undefined;
  const preserveQueryWithoutMode = buildRentTrackerPreserveQuery({
    propertyId,
    tenancyId,
    paymentId,
    tenantId,
  });
  const rentTrackerPreserveHref =
    preserveQueryWithoutMode.length > 0
      ? `/dashboard/rent-tracker?${preserveQueryWithoutMode}`
      : "/dashboard/rent-tracker";

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
            tenantId={tenantId}
            resolvedRentTrackerMode={resolvedRentTrackerMode}
            unknownRentTrackerModeDropped={unknownRentTrackerModeDropped}
            rentTrackerPreserveHref={rentTrackerPreserveHref}
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
  tenantId,
  resolvedRentTrackerMode,
  unknownRentTrackerModeDropped,
  rentTrackerPreserveHref,
}: {
  userId: string;
  todayIso: string;
  propertyId?: string;
  tenancyId?: string;
  paymentId?: string;
  tenantId?: string;
  resolvedRentTrackerMode: RentTrackerResolvedDisplayMode;
  unknownRentTrackerModeDropped: boolean;
  rentTrackerPreserveHref: string;
}) {
  const dbgRentTracker = process.env.LETORA_DEBUG_RENT_TRACKER === "1";
  if (dbgRentTracker) {
    console.info("[rent-tracker] server fetch start");
  }
  const fetchStarted = dbgRentTracker ? Date.now() : 0;
  const [payments, tenancies, pendingApprovals] = await Promise.all([
    getRentPayments(),
    getTenancies(userId),
    getPendingApprovalsForRentChase(),
  ]);
  if (dbgRentTracker) {
    console.info("[rent-tracker] server fetch end", {
      ms: Date.now() - fetchStarted,
      payments: payments.length,
      tenancies: tenancies.length,
      pendingApprovals: pendingApprovals.length,
    });
  }
  const {
    scopedTenancies,
    scopedPayments,
    focusPaymentId,
    requestedPaymentMissing,
    requestedTenancyMissing,
    requestedTenantMissing,
    paymentTenantContextConflict,
    tenancyTenantContextConflict,
    usedFullListFallback,
  } = scopeRentTrackerData({
    tenancies,
    payments,
    propertyId,
    tenancyId,
    paymentId,
    tenantId,
  });
  const stats = computeRentTrackerStats(scopedPayments, todayIso, scopedTenancies);
  const showQueueBacktrail = Boolean(paymentId ?? tenancyId ?? tenantId);
  const { modePausedForFocus: rentTrackerModePausedForFocus } = applyRentTrackerDisplayMode(
    scopedPayments,
    resolvedRentTrackerMode,
    todayIso,
    focusPaymentId,
  );
  /** Queue rows already land on a specific instalment — skip duplicate “arrears” KPI ribbon. */
  const suppressRentTrackerModeRibbon = Boolean(paymentId) && resolvedRentTrackerMode === "arrears";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RentTrackerOperationalContextStrip
        showQueueBacktrail={showQueueBacktrail}
        requestedPaymentMissing={requestedPaymentMissing}
        requestedTenancyMissing={requestedTenancyMissing}
        requestedTenantMissing={requestedTenantMissing}
        paymentTenantContextConflict={paymentTenantContextConflict}
        tenancyTenantContextConflict={tenancyTenantContextConflict}
        usedFullListFallback={usedFullListFallback}
        resolvedRentTrackerMode={resolvedRentTrackerMode}
        unknownRentTrackerModeDropped={unknownRentTrackerModeDropped}
        rentTrackerModePausedForFocus={rentTrackerModePausedForFocus}
        suppressRentTrackerModeRibbon={suppressRentTrackerModeRibbon}
      />
      {propertyId ? (
        <div className="shrink-0 border-b border-[#282828] bg-[#141414] px-4 py-2 md:px-6">
          <PropertyPortfolioBackLink propertyId={propertyId} className="text-[#868686] hover:text-zinc-400" />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-24 pt-4 md:px-6 md:pb-32 md:pt-6">
        <RentTrackerContent
          payments={scopedPayments}
          stats={stats}
          todayIso={todayIso}
          pendingApprovals={pendingApprovals}
          focusPaymentId={focusPaymentId}
          canonicalRentTrackerMode={resolvedRentTrackerMode}
          rentTrackerPreserveHref={rentTrackerPreserveHref}
        />
      </div>
    </div>
  );
}

function RentTrackerLoadingShell({ todayIso }: { todayIso: string }) {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[#0B0B0B] font-['Inter',system-ui,sans-serif] text-[#e6e3e1]">
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