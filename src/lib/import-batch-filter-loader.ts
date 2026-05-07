import { getBatchImportById } from "@/lib/actions/batch-onboarding";
import { deriveEntityIdSets } from "@/lib/onboarding/batch-import-reconciliation";

export async function loadImportBatchIdFilterSets(batchId: string): Promise<
  | { ok: false }
  | {
      ok: true;
      propertyIds: Set<string>;
      tenantIds: Set<string>;
      tenancyIds: Set<string>;
    }
> {
  const loaded = await getBatchImportById(batchId);
  if (!loaded.ok) return { ok: false };
  const { propertyIds, tenantIds, tenancyIds } = deriveEntityIdSets(loaded.batch.rows);
  return { ok: true, propertyIds, tenantIds, tenancyIds };
}
