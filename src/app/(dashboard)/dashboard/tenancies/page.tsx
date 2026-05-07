export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ImportBatchScopeChip } from "@/components/import/import-batch-scope-chip";
import { TenanciesRegistry } from "@/components/tenancies/tenancies-registry";
import { AddTenancyDialog } from "@/components/rent/add-tenancy-dialog";
import {
  autoGeneratePendingPayments,
  getTenancies,
  getThisMonthPayments,
} from "@/lib/actions/tenancies";
import { getProperties } from "@/lib/actions/properties";
import { getTenants } from "@/lib/actions/tenants";
import { loadImportBatchIdFilterSets } from "@/lib/import-batch-filter-loader";
import { scopedTenancyRows } from "@/lib/import-batch-list-scope";
import { importBatchShortLabel, parseImportBatchParam } from "@/lib/import-batch-query";
import { createClient } from "@/lib/supabase/server";

import {
  loadTenancyInspectorActivityByTenancyId,
  loadTenancyOnboardingTasksByTenancyId,
} from "./tenancy-inspector-data";

async function TenanciesDataSection({ importBatchId }: { importBatchId?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  // Keep existing monthly payment automation, but isolate it from the page shell.
  if (userId) {
    await autoGeneratePendingPayments(userId);
  }

  const [properties, tenants, tenancies, payments, batchFilter] = userId
    ? await Promise.all([
        getProperties(userId),
        getTenants(userId),
        getTenancies(userId),
        getThisMonthPayments(userId),
        importBatchId ? loadImportBatchIdFilterSets(importBatchId) : Promise.resolve(null),
      ])
    : [[], [], [], [], null];

  let list = scopedTenancyRows(tenancies, batchFilter ?? null);

  const scope =
    userId && importBatchId && batchFilter?.ok
      ? { batchId: importBatchId, short: importBatchShortLabel(importBatchId) }
      : null;

  const tenancyIds = list.map((t) => t.id);
  const [activityByTenancyId, onboardingTasksByTenancyId] =
    tenancyIds.length > 0
      ? await Promise.all([
          loadTenancyInspectorActivityByTenancyId(list),
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
    <>
      {scope ? (
        <div className="mb-6">
          <ImportBatchScopeChip batchId={scope.batchId} shortId={scope.short} clearHref="/dashboard/tenancies" />
          {list.length === 0 ? (
            <p className="mt-3 font-mono text-[11px] text-zinc-500">
              No tenancies matched this batch snapshot — open batch results to confirm tenancy IDs, or clear the filter.
            </p>
          ) : null}
        </div>
      ) : null}
      <TenanciesRegistry
        tenancies={list}
        paymentsThisMonth={payments}
        userId={userId}
        propertyOptions={propertyOptions}
        tenantOptions={tenantOptions}
        activityByTenancyId={activityByTenancyId}
        onboardingTasksByTenancyId={onboardingTasksByTenancyId}
        totalPropertiesCount={properties.length}
      />
    </>
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

export default async function TenanciesPage({
  searchParams,
}: {
  searchParams: Promise<{ importBatch?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const sp = await searchParams;
  const importBatchId = parseImportBatchParam(sp);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0B0B0B] p-4 lg:p-8">
      {/* A. Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-['Inter',sans-serif] text-xl font-semibold tracking-tight text-white md:text-2xl">
            Tenancies
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
            Occupancy & Rent Context // Live Records
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/tenants"
            className="border border-[#333333] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition-colors hover:bg-[#161616]"
          >
            View Tenants
          </Link>
          <Link
            href="/dashboard/properties"
            className="border border-[#333333] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition-colors hover:bg-[#161616]"
          >
            View Portfolio
          </Link>
          <AddTenancyLink />
        </div>
      </div>

      {/* B & C. KPIs and Main Registry */}
      <Suspense fallback={<TenanciesPageFallback />}>
        <TenanciesDataSection importBatchId={importBatchId} />
      </Suspense>
    </div>
  );
}

// AddTenancyLink needs to handle the dialog trigger, so we create a small wrapper or just use the button style.
async function AddTenancyLink() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [properties, tenants] = await Promise.all([
    getProperties(user.id),
    getTenants(user.id)
  ]);

  const propertyOptions = properties.map((p) => ({
    id: p.id,
    label: p.address ?? "Property",
  }));

  const tenantOptions = tenants.map((t) => ({
    id: t.id,
    label: `${t.fullName ?? "Tenant"}${t.email ? ` (${t.email})` : ""}`,
  }));

  return (
    <AddTenancyDialog
      properties={propertyOptions}
      tenants={tenantOptions}
      trigger={
        <button className="bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-zinc-200">
          Add Tenancy
        </button>
      }
    />
  );
}
