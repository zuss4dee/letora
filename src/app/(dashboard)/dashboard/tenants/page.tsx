import { Suspense } from "react";

import { PropertyPortfolioBackLink } from "@/components/dashboard/property-portfolio-back-link";
import { TenantsDashboardList } from "@/components/tenants/tenants-dashboard-list";
import { getTenancies } from "@/lib/actions/tenancies";
import { getTenants } from "@/lib/actions/tenants";
import { createClient } from "@/lib/supabase/server";

async function TenantsTableSection({ propertyId }: { propertyId?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const tenants = userId ? await getTenants(userId) : [];

  if (userId == null || propertyId == null) {
    return <TenantsDashboardList tenants={tenants} />;
  }

  const tenancies = await getTenancies(userId);
  const tenantIdsOnProperty = new Set(
    tenancies
      .filter((t) => t.propertyId === propertyId && t.tenantId != null)
      .map((t) => String(t.tenantId)),
  );
  const scoped = tenants.filter((t) => tenantIdsOnProperty.has(t.id));

  return <TenantsDashboardList tenants={scoped} />;
}

function TenantsTableFallback() {
  return (
    <>
      <div className="flex h-12 items-center border-b border-zinc-200/70 bg-zinc-100 px-4 dark:border-zinc-800 dark:bg-[#161616]">
        <div className="h-5 w-40 animate-pulse rounded-[2px] bg-zinc-200/80 dark:bg-zinc-800/60" />
      </div>
      <div className="flex-1 overflow-auto">
        <div className="space-y-2 px-4 py-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-[2px] bg-zinc-200/80 dark:bg-zinc-800/60"
            />
          ))}
        </div>
      </div>
      <div className="h-8 border-t border-zinc-200/70 bg-zinc-100 dark:border-zinc-800 dark:bg-[#131313]" />
    </>
  );
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.propertyId;
  const propertyId =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;

  return (
    <div className="flex min-h-[calc(100vh-2.5rem)] flex-col bg-[#f8f8f7] text-zinc-950 dark:bg-[#0B0B0B] dark:text-zinc-100">
      <section className="flex min-h-0 flex-1 flex-col border-y border-zinc-200/70 bg-[#161616] dark:border-zinc-800 dark:bg-[#1A1A1A]">
        {propertyId ? (
          <div className="shrink-0 border-b border-zinc-200/70 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-[#141414]">
            <Suspense fallback={<div className="h-4 w-44 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80" />}>
              <PropertyPortfolioBackLink propertyId={propertyId} />
            </Suspense>
          </div>
        ) : null}
        <Suspense fallback={<TenantsTableFallback />}>
          <TenantsTableSection propertyId={propertyId} />
        </Suspense>
      </section>
    </div>
  );
}
