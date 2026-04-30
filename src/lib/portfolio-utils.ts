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
  const [
    { count: totalProperties },
    { count: activeTenancies },
    { count: totalTenants }
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("tenancies")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("user_id", userId), // Assuming tenancies has user_id or linked via properties
    supabase
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
  ]);

  // For Letora, "Lettable Units" is usually total properties 
  // unless we have multi-unit properties in the future.
  const lettableUnits = totalProperties ?? 0;

  return {
    totalProperties: totalProperties ?? 0,
    activeTenancies: activeTenancies ?? 0,
    totalTenants: totalTenants ?? 0,
    lettableUnits,
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
