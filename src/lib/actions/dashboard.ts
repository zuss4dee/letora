"use server";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";

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
    .select("id,status,due_date")
    .eq("user_id", userId);

  if (error || !data) return 0;

  return data.filter((row) => {
    const st = (row.status ?? "").toLowerCase();
    return st === "overdue" || (st === "pending" && !!row.due_date && row.due_date < today);
  }).length;
}

export type DashboardStats = {
  totalProperties: number;
  rentCollectedThisMonth: number;
  overduePayments: number;
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
  const { start, next } = getMonthRangeUtc();
  const startDate = start.toISOString().slice(0, 10);
  const nextDate = next.toISOString().slice(0, 10);

  const [
    totalPropertiesRes,
    rentCollectedRes,
    overduePaymentsRes,
    openMaintenanceRes,
    activeLeadsRes,
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),

    supabase
      .from("rent_payments")
      .select("amount_paid,paid_on,tenancies!inner(properties!inner(user_id))")
      .eq("tenancies.properties.user_id", userId)
      .gte("paid_on", startDate)
      .lt("paid_on", nextDate),

    supabase
      .from("rent_payments")
      .select("id,tenancies!inner(properties!inner(user_id))", { count: "exact", head: true })
      .eq("status", "overdue")
      .eq("tenancies.properties.user_id", userId),

    supabase
      .from("maintenance_requests")
      .select("id,tenancies!inner(properties!inner(user_id))", { count: "exact", head: true })
      .in("status", ["open", "in_progress"])
      .eq("tenancies.properties.user_id", userId),

    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("qualified_status", "pending"),
  ]);

  const totalProperties = totalPropertiesRes.count ?? 0;

  const rentCollectedThisMonth = (rentCollectedRes.data ?? []).reduce((sum, row) => {
    const amount =
      typeof row.amount_paid === "number" ? row.amount_paid : Number(row.amount_paid ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const overduePayments = overduePaymentsRes.count ?? 0;
  const openMaintenance = openMaintenanceRes.count ?? 0;
  const activeLeads = activeLeadsRes.count ?? 0;

  return {
    totalProperties,
    rentCollectedThisMonth,
    overduePayments,
    openMaintenance,
    activeLeads,
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
      "due_date,amount_due,status,tenancies!inner(properties!inner(address,user_id),tenant_profiles(full_name))",
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
          tenant_profiles?: { full_name?: string | null } | null;
        }
      | null
      | undefined;

    return {
      propertyAddress: normalizePropertyAddressLabel(tenancy?.properties?.address ?? "") || null,
      tenantFullName: tenancy?.tenant_profiles?.full_name ?? null,
      dueDate: row.due_date ?? null,
      amountDue:
        row.amount_due == null
          ? null
          : typeof row.amount_due === "number"
            ? row.amount_due
            : Number(row.amount_due),
      status: row.status ?? null,
    };
  });
}

