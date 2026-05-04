"use server";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";
import { isPaymentOverdue, resolvePaymentAmount } from "@/lib/rent-utils";
import { getPortfolioCounts } from "@/lib/portfolio-utils";

/** Sum of `monthly_rent` for tenancies with `status = 'active'` owned by the user. */
export async function getMonthlyRentFromActiveTenancies(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenancies")
    .select("monthly_rent, properties!inner(user_id)")
    .eq("properties.user_id", userId)
    .eq("status", "active");

  if (error || !data) return 0;

  return data.reduce((sum, row) => {
    const raw = row.monthly_rent;
    const n = raw == null ? 0 : typeof raw === "number" ? raw : Number(raw);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** Count of rent payments that are overdue or pending with a past due date. */
export async function getOverdueRentPaymentCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("rent_payments")
    .select("id,status,due_date,tenancies!inner(properties!inner(user_id))")
    .eq("tenancies.properties.user_id", userId);

  if (error || !data) return 0;

  return data.filter((row) => {
    return isPaymentOverdue(row.status, row.due_date, today);
  }).length;
}

export type DashboardStats = {
  totalProperties: number;
  activeTenants: number;
  lettableUnits: number;
  /** Rounded arrears GBP (historical KPI field name). Prefer `arrearsOutstanding`. */
  overduePayments: number;
  /** Exact sum of overdue-ish instalments in GBP (`isPaymentOverdue` × `resolvePaymentAmount`). */
  arrearsOutstanding: number;
  openMaintenance: number;
  activeLeads: number;
};

export type ThisMonthsRentPayment = {
  propertyAddress: string | null;
  tenantFullName: string | null;
  dueDate: string | null;
  amountDue: number | null;
  status: string | null;
};

function getMonthRangeUtc(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, next };
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = await createClient();

  const [{ data: paymentRows }, portfolio, openMaintRes, activeLeadsRes] = await Promise.all([
    supabase
      .from("rent_payments")
      .select("status,due_date,amount,tenancies!inner(properties!inner(user_id))")
      .eq("tenancies.properties.user_id", userId),
    getPortfolioCounts(supabase, userId),
    supabase
      .from("maintenance_requests")
      .select("id,tenancies!inner(properties!inner(user_id))", { count: "exact", head: true })
      .in("status", ["open", "in_progress"])
      .eq("tenancies.properties.user_id", userId),
    supabase
      .from("leads")
      .select("id, properties!inner(user_id)", { count: "exact", head: true })
      .eq("properties.user_id", userId)
      .ilike("qualified_status", "pending"),
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);
  
  const arrearsTotal = (paymentRows ?? []).reduce((sum, p) => {
    if (isPaymentOverdue(p.status, p.due_date, todayIso)) {
      return sum + resolvePaymentAmount(p);
    }
    return sum;
  }, 0);

  return {
    overduePayments: Math.round(arrearsTotal),
    arrearsOutstanding: arrearsTotal,
    activeTenants: portfolio.totalTenants,
    totalProperties: portfolio.totalProperties,
    lettableUnits: portfolio.lettableUnits,
    openMaintenance: openMaintRes.count ?? 0,
    activeLeads: activeLeadsRes.count ?? 0,
  };
}

export async function getThisMonthsRentPayments(
  userId: string,
): Promise<ThisMonthsRentPayment[]> {
  const supabase = await createClient();
  const { start, next } = getMonthRangeUtc();
  const startDate = start.toISOString().slice(0, 10);
  const nextDate = next.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("rent_payments")
    .select(
      "due_date,amount,status,tenancies!inner(properties!inner(address,user_id),tenants(full_name))",
    )
    .eq("tenancies.properties.user_id", userId)
    .gte("due_date", startDate)
    .lt("due_date", nextDate)
    .order("due_date", { ascending: true });

  if (error) return [];

  return (data ?? []).map((row) => {
    const tenancy = (row as unknown as { tenancies?: unknown }).tenancies as
      | {
          properties?: { address?: string | null } | null;
          tenants?: { full_name?: string | null } | null;
        }
      | null
      | undefined;

    return {
      propertyAddress: normalizePropertyAddressLabel(tenancy?.properties?.address ?? "") || null,
      tenantFullName: tenancy?.tenants?.full_name ?? null,
      dueDate: row.due_date ?? null,
      amountDue: resolvePaymentAmount(row),
      status: row.status ?? null,
    };
  });
}

