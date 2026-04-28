export const dynamic = "force-dynamic";

import { Suspense } from "react";

import { TenanciesRegistry } from "@/components/tenancies/tenancies-registry";
import {
  autoGeneratePendingPayments,
  getTenancies,
  getThisMonthPayments,
} from "@/lib/actions/tenancies";
import { getProperties } from "@/lib/actions/properties";
import { getTenants } from "@/lib/actions/tenants";
import { createClient } from "@/lib/supabase/server";

import {
  loadTenancyInspectorActivityByTenancyId,
  loadTenancyOnboardingTasksByTenancyId,
} from "./tenancy-inspector-data";

async function TenanciesDataSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  // Keep existing monthly payment automation, but isolate it from the page shell.
  if (userId) {
    await autoGeneratePendingPayments(userId);
  }

  const [properties, tenants, tenancies, payments] = userId
    ? await Promise.all([
        getProperties(userId),
        getTenants(userId),
        getTenancies(userId),
        getThisMonthPayments(userId),
      ])
    : [[], [], [], []];

  const tenancyIds = tenancies.map((t) => t.id);
  const [activityByTenancyId, onboardingTasksByTenancyId] =
    tenancyIds.length > 0
      ? await Promise.all([
          loadTenancyInspectorActivityByTenancyId(tenancies),
          loadTenancyOnboardingTasksByTenancyId(tenancyIds),
        ])
      : [{}, {}];

  const propertyOptions = properties.map((p) => ({
    id: p.id,
    label: p.address ?? "Property",
  }));

  const tenantOptions = tenants.map((t) => ({
    id: t.id,
    label: `${t.fullName ?? "Tenant"}${t.email ? ` (${t.email})` : ""}`,
  }));

  return (
    <TenanciesRegistry
      tenancies={tenancies}
      paymentsThisMonth={payments}
      userId={userId}
      propertyOptions={propertyOptions}
      tenantOptions={tenantOptions}
      activityByTenancyId={activityByTenancyId}
      onboardingTasksByTenancyId={onboardingTasksByTenancyId}
    />
  );
}

function TenanciesPageFallback() {
  return (
    <div className="flex min-h-0 flex-1 bg-[#0e0e0e]">
      <div className="flex min-w-0 flex-1 flex-col border-r border-[#232323]">
        <div className="h-11 border-b border-[#232323] bg-[#111111]" />
        <div className="min-h-0 flex-1 p-3">
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-[2px] bg-[#1a1a1a]" />
            ))}
          </div>
        </div>
      </div>
      <aside className="hidden w-80 border-l border-[#232323] bg-[#111111] lg:block">
        <div className="h-24 border-b border-[#232323]" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-[2px] bg-[#1a1a1a]" />
          ))}
        </div>
      </aside>
    </div>
  );
}

export default function TenanciesPage() {
  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<TenanciesPageFallback />}>
        <TenanciesDataSection />
      </Suspense>
    </div>
  );
}
