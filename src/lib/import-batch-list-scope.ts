/** Result from {@link loadImportBatchIdFilterSets} */
export type ImportBatchScopeSets =
  | { ok: false }
  | {
      ok: true;
      propertyIds: Set<string>;
      tenantIds: Set<string>;
      tenancyIds: Set<string>;
    };

export type PortfolioRowLike = { id: string };
export type TenancyLike = { id: string; propertyId?: string | null; tenantId?: string | null };
export type TenantLike = { id: string };

/** Properties list: intersect with batch snapshot IDs (empty set → no rows while scoped). */
export function scopedPortfolioRows<T extends PortfolioRowLike>(rows: T[], scope: ImportBatchScopeSets | null): T[] {
  if (!scope?.ok) return [...rows];
  if (scope.propertyIds.size === 0) return [];
  return rows.filter((r) => scope.propertyIds.has(r.id));
}

/** Tenancies list: intersect with batch tenancy IDs. */
export function scopedTenancyRows<T extends TenancyLike>(rows: T[], scope: ImportBatchScopeSets | null): T[] {
  if (!scope?.ok) return [...rows];
  if (scope.tenancyIds.size === 0) return [];
  return rows.filter((r) => scope.tenancyIds.has(r.id));
}

/**
 * Tenants: intersect with batch tenant IDs when scoped.
 * When `restrictToPropertyId` is set, first restrict to tenants linked to active tenancies on that property.
 */
export function scopedTenantRows<T extends TenantLike>(
  tenants: T[],
  tenancies: readonly TenancyLike[],
  scope: ImportBatchScopeSets | null,
  restrictToPropertyId?: string | null,
): T[] {
  let list = [...tenants];

  if (restrictToPropertyId) {
    const allowed = new Set(
      tenancies
        .filter((t) => t.propertyId === restrictToPropertyId && t.tenantId != null)
        .map((t) => String(t.tenantId)),
    );
    list = list.filter((t) => allowed.has(t.id));
  }

  if (!scope?.ok) return list;
  if (scope.tenantIds.size === 0) return [];
  return list.filter((t) => scope.tenantIds.has(t.id));
}
