export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PropertyPortfolioBackLink } from "@/components/dashboard/property-portfolio-back-link";
import { RentTrackerContent } from "@/components/rent-tracker/rent-tracker-content";
import { getRentPayments } from "@/lib/actions/rent-tracker";
import { computeRentTrackerStats } from "@/lib/rent-tracker-stats";
import { getTenancies } from "@/lib/actions/tenancies";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { createClient } from "@/lib/supabase/server";

export default async function RentTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  if (!userId) notFound();

  const sp = await searchParams;
  const raw = sp.propertyId;
  const propertyId =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <>
      <DashboardPollRefresh />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <Suspense fallback={<RentTrackerLoadingShell todayIso={todayIso} />}>
          <RentTrackerAsyncSection
            userId={userId}
            todayIso={todayIso}
            propertyId={propertyId}
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
}: {
  userId: string;
  todayIso: string;
  propertyId?: string;
}) {
  const [payments, tenancies] = await Promise.all([
    getRentPayments(),
    getTenancies(userId),
  ]);
  const scopedTenancies =
    propertyId == null ? tenancies : tenancies.filter((t) => t.propertyId === propertyId);
  const tenancyIdSet = new Set(scopedTenancies.map((t) => t.id));
  const scopedPayments =
    propertyId == null
      ? payments
      : payments.filter((p) => p.tenancyId != null && tenancyIdSet.has(p.tenancyId));
  const stats = computeRentTrackerStats(scopedPayments, todayIso);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {propertyId ? (
        <div className="shrink-0 border-b border-[#282828] bg-[#141414] px-5 py-2">
          <PropertyPortfolioBackLink propertyId={propertyId} className="text-[#868686] hover:text-zinc-400" />
        </div>
      ) : null}
      <RentTrackerContent
        payments={scopedPayments}
        stats={stats}
        tenancies={scopedTenancies}
        todayIso={todayIso}
      />
    </div>
  );
}

function RentTrackerLoadingShell({ todayIso }: { todayIso: string }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0f0f0f] text-[#e6e3e1]">
      <div className="border-b border-[#282828] bg-[#141414] px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#868686]">
          Rent Tracker / {todayIso}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">Rent Operations</h1>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-[#282828] bg-[#282828] md:grid-cols-4">
        {["Expected", "Collected", "Arrears", "Forecast"].map((label) => (
          <div key={label} className="bg-[#161616] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#6f6f6f]">{label}</p>
            <div className="mt-2 h-7 w-28 animate-pulse rounded-sm bg-[#242424]" />
          </div>
        ))}
      </div>

      <div className="flex-1 bg-[#121212] p-5">
        <div className="mb-4 h-10 animate-pulse rounded-sm border border-[#282828] bg-[#171717]" />
        <div className="overflow-hidden border border-[#282828] bg-[#151515]">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse border-b border-[#242424] bg-[#151515] last:border-b-0"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
