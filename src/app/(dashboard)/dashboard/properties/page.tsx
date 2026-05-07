export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ImportBatchScopeChip } from "@/components/import/import-batch-scope-chip";
import { ManagedPropertiesRegistry } from "@/components/properties/managed-properties-registry";
import { loadImportBatchIdFilterSets } from "@/lib/import-batch-filter-loader";
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

  let list = rows;
  let scope: { batchId: string; short: string } | null = null;

  if (importBatchId && batchFilter?.ok) {
    scope = { batchId: importBatchId, short: importBatchShortLabel(importBatchId) };
    if (batchFilter.propertyIds.size > 0) {
      list = rows.filter((r) => batchFilter.propertyIds.has(r.id));
    } else {
      list = [];
    }
  }

  const ids = list.map((r) => r.id);
  const [activityByPropertyId, complianceByPropertyId] = await Promise.all([
    loadPropertyInspectorActivityByPropertyId(ids),
    loadPropertyInspectorComplianceByPropertyId(ids),
  ]);

  return (
    <>
      {scope ? (
        <div className="shrink-0 px-4 pt-4 lg:px-6">
          <ImportBatchScopeChip batchId={scope.batchId} shortId={scope.short} clearHref="/dashboard/properties" />
        </div>
      ) : null}
      <ManagedPropertiesRegistry
        rows={list}
        activityByPropertyId={activityByPropertyId}
        complianceByPropertyId={complianceByPropertyId}
        initialSelectedPropertyId={initialSelectedPropertyId}
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
    <div className="flex min-h-0 flex-1 flex-col bg-[#0B0B0B]">
      <Suspense fallback={<div className="p-6 text-sm text-zinc-400">Loading properties…</div>}>
        <PropertiesPortfolioContent
          userId={user.id}
          initialSelectedPropertyId={initialSelectedPropertyId}
          importBatchId={importBatchId}
        />
      </Suspense>
    </div>
  );
}
