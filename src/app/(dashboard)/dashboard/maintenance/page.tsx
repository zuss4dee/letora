export const dynamic = "force-dynamic";

import { Suspense } from "react";

import { MaintenanceWorkspaceClient } from "@/components/maintenance/maintenance-workspace-client";
import { PropertyPortfolioBackLink } from "@/components/dashboard/property-portfolio-back-link";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import type { MaintenanceRequestRow } from "@/lib/actions/maintenance";
import { getMaintenanceRequests } from "@/lib/actions/maintenance";
import { createClient } from "@/lib/supabase/server";

async function MaintenanceWorkspaceSection({ propertyId }: { propertyId?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const requests = userId ? await getMaintenanceRequests(userId) : { open: [], resolved: [] };

  const matchesProperty = (row: MaintenanceRequestRow) =>
    propertyId == null || row.propertyId === propertyId;

  const openFiltered = requests.open.filter(matchesProperty);
  const resolvedFiltered = requests.resolved.filter(matchesProperty);

  const openSorted = [...openFiltered].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const rows = [...openSorted, ...resolvedFiltered].slice(0, 20);
  const activeCount = openFiltered.length;

  return <MaintenanceWorkspaceClient rows={rows} activeCount={activeCount} />;
}

function MaintenanceWorkspaceFallback() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="h-10 shrink-0 border-b border-[#282828] bg-[#0B0B0B] px-4" />
      <main className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col bg-[#1A1A1A]">
          <div className="h-16 shrink-0 border-b border-[#282828] p-4" />
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-[2px] bg-[#242424]" />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.propertyId;
  const propertyId =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DashboardPollRefresh />
      {propertyId ? (
        <div className="shrink-0 border-b border-[#282828] bg-[#0B0B0B] px-4 py-2">
          <Suspense fallback={<div className="h-4 w-44 animate-pulse rounded bg-[#242424]" />}>
            <PropertyPortfolioBackLink propertyId={propertyId} />
          </Suspense>
        </div>
      ) : null}
      <Suspense fallback={<MaintenanceWorkspaceFallback />}>
        <MaintenanceWorkspaceSection propertyId={propertyId} />
      </Suspense>
    </div>
  );
}
