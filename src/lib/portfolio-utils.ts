import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared utility for counting core portfolio metrics to ensure consistency 
 * between dashboard cards, sidebar counters, and detail pages.
 */

export type PortfolioCounts = {
  totalProperties: number;
  activeTenancies: number;
  totalTenants: number;
  lettableUnits: number;
};

export async function getPortfolioCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<PortfolioCounts> {
  // We use Promise.all for speed. 
  const [
    propRes,
    tenancyRes,
    tenantRes
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("tenancies")
      .select("id, properties!inner(user_id)", { count: "exact", head: true })
      .eq("properties.user_id", userId)
      .eq("status", "active"),
    supabase
      .from("tenants")
      .select("id, tenancies!inner(properties!inner(user_id))", { count: "exact", head: true })
      .eq("tenancies.properties.user_id", userId)
  ]);

  if (propRes.error) console.error("[getPortfolioCounts] properties error:", propRes.error.message);
  if (tenancyRes.error) console.error("[getPortfolioCounts] tenancies error:", tenancyRes.error.message);
  if (tenantRes.error) console.error("[getPortfolioCounts] tenants error:", tenantRes.error.message);

  const totalProperties = propRes.count ?? 0;
  const activeTenancies = tenancyRes.count ?? 0;
  const totalTenants = tenantRes.count ?? 0;

  return {
    totalProperties,
    activeTenancies,
    totalTenants,
    lettableUnits: totalProperties,
  };
}

/**
 * Resolves which property a maintenance request or payment belongs to,
 * handling nested tenancy relations if the direct property_id is missing.
 */
export function resolvePropertyId(row: {
  property_id?: string | null;
  tenancies?: { property_id?: string | null } | { property_id?: string | null }[] | null;
}): string | null {
  if (row.property_id != null && String(row.property_id) !== "") return String(row.property_id);
  const t = row.tenancies;
  if (!t) return null;
  const one = Array.isArray(t) ? t[0] : t;
  return one?.property_id != null ? String(one.property_id) : null;
}
