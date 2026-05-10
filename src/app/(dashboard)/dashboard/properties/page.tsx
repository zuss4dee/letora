export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ImportBatchScopeChip } from "@/components/import/import-batch-scope-chip";
import { ManagedPropertiesRegistry } from "@/components/properties/managed-properties-registry";
import { loadImportBatchIdFilterSets } from "@/lib/import-batch-filter-loader";
import { scopedPortfolioRows } from "@/lib/import-batch-list-scope";
import { importBatchShortLabel, parseImportBatchParam } from "@/lib/import-batch-query";
import { getPropertiesPortfolio } from "@/lib/actions/properties";
import { createClient } from "@/lib/supabase/server";

import { loadPropertyInspectorActivityByPropertyId } from "./property-inspector-activity";
import { loadPropertyInspectorComplianceByPropertyId } from "./property-inspector-compliance";

async function PropertiesPortfolioContent({
  userId,
  initialSelectedPropertyId,
  importBatchId,
}: {
  userId: string;
  initialSelectedPropertyId: string | null;
  importBatchId?: string;
}) {
  const rows = await getPropertiesPortfolio(userId);
  const batchFilter = importBatchId ? await loadImportBatchIdFilterSets(importBatchId) : null;

  const scopeBatch =
    importBatchId && batchFilter?.ok
      ? { batchId: importBatchId, short: importBatchShortLabel(importBatchId) }
      : null;

  const list = scopedPortfolioRows(rows, batchFilter ?? null);

  const selectedEffective =
    initialSelectedPropertyId != null && list.some((r) => r.id === initialSelectedPropertyId)
      ? initialSelectedPropertyId
      : null;

  const clearHref =
    initialSelectedPropertyId != null && initialSelectedPropertyId.length > 0
      ? `/dashboard/properties?propertyId=${encodeURIComponent(initialSelectedPropertyId)}`
      : "/dashboard/properties";

  const ids = list.map((r) => r.id);
  const [activityByPropertyId, complianceByPropertyId] = await Promise.all([
    loadPropertyInspectorActivityByPropertyId(ids),
    loadPropertyInspectorComplianceByPropertyId(ids),
  ]);

  return (
    <>
      {scopeBatch ? (
        <div className="shrink-0 px-4 pt-4 lg:px-6">
          <ImportBatchScopeChip batchId={scopeBatch.batchId} shortId={scopeBatch.short} clearHref={clearHref} />
          {list.length === 0 ? (
            <p className="mx-auto mb-4 max-w-5xl font-mono text-[11px] text-zinc-500">
              No portfolio properties matched this batch snapshot — either IDs were missing on older imports, or the
              selected property drill-down excludes all batch rows.
            </p>
          ) : null}
        </div>
      ) : null}
      <ManagedPropertiesRegistry
        rows={list}
        activityByPropertyId={activityByPropertyId}
        complianceByPropertyId={complianceByPropertyId}
        initialSelectedPropertyId={selectedEffective}
      />
    </>
  );
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; importBatch?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const raw = sp.propertyId;
  const initialSelectedPropertyId =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
  const importBatchId = parseImportBatchParam(sp);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background dark:bg-[#f8f8f7] text-zinc-950 dark:bg-[#0B0B0B] dark:text-zinc-100">
      <Suspense fallback={<div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Loading properties…</div>}>
        <PropertiesPortfolioContent
          userId={user.id}
          initialSelectedPropertyId={initialSelectedPropertyId}
          importBatchId={importBatchId}
        />
      </Suspense>
    </div>
  );
}
