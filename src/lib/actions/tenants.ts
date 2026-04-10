"use server";

import { revalidatePath } from "next/cache";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";
import { tenantSchema, tenantUpdateSchema } from "@/lib/validations/tenant";
import { userFacingError } from "@/lib/user-facing-errors";

export type TenantRentStatus = "paid" | "overdue" | "pending";

export type TenantRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  propertyAddress: string | null;
  propertyLine1: string | null;
  propertySubtitle: string | null;
  rightToRentStatus: string | null;
  tenancyStatus: string | null;
  onboardingStatus: string | null;
  tenancyId: string | null;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
  leaseMonths: number | null;
  rentStatus: TenantRentStatus;
  createdAt: string | null;
};

export async function getTenants(userId: string): Promise<TenantRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenants")
    .select(
      `id,full_name,email,phone,right_to_rent_status,created_at,
      tenancies(
        id,
        status,
        start_date,
        end_date,
        onboarding_status,
        properties(address,city,property_type),
        rent_payments(status,due_date)
      )`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => mapTenantListRow(row));
}

function pickPrimaryTenancy(
  tenancies: Array<{
    id?: string;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    onboarding_status?: string | null;
    properties?: { address?: string | null; city?: string | null; property_type?: string | null } | null;
    rent_payments?: unknown;
  }>,
) {
  const list = Array.isArray(tenancies) ? tenancies : [];
  const active = list.filter((t) => (t.status ?? "").toLowerCase() === "active");
  const pool = active.length > 0 ? active : list;
  return pool.sort((a, b) => {
    const aStart = a.start_date ? new Date(a.start_date).getTime() : 0;
    const bStart = b.start_date ? new Date(b.start_date).getTime() : 0;
    return bStart - aStart;
  })[0] ?? null;
}

function aggregateRentStatus(payments: unknown): TenantRentStatus {
  const list = Array.isArray(payments) ? payments : [];
  const statuses = list.map((p) => ((p as { status?: string | null }).status ?? "").toLowerCase());
  if (statuses.some((s) => s === "overdue")) return "overdue";
  if (statuses.some((s) => s === "pending")) return "pending";
  if (statuses.some((s) => s === "paid")) return "paid";
  return "pending";
}

function splitPropertyLines(
  address: string | null,
  city: string | null,
  propertyType: string | null,
): { line1: string | null; subtitle: string | null } {
  const normalized = normalizePropertyAddressLabel(address ?? "");
  if (!normalized.trim()) {
    return {
      line1: null,
      subtitle: city?.trim() || propertyType?.trim() || null,
    };
  }
  const parts = normalized.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      line1: parts[0] ?? normalized,
      subtitle: parts.slice(1).join(", ") || city?.trim() || propertyType?.trim() || null,
    };
  }
  return {
    line1: normalized,
    subtitle: city?.trim() || propertyType?.trim() || null,
  };
}

function leaseMonthSpan(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return Math.max(0, months);
}

function mapTenantListRow(row: {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  right_to_rent_status?: string | null;
  created_at?: string | null;
  tenancies?: unknown;
}): TenantRow {
  const tenancies = (row.tenancies ?? []) as Array<{
    id?: string;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    onboarding_status?: string | null;
    properties?: { address?: string | null; city?: string | null; property_type?: string | null } | null;
    rent_payments?: Array<{ status?: string | null; due_date?: string | null }> | null;
  }>;

  const t = pickPrimaryTenancy(tenancies);
  const addr = t?.properties?.address ?? null;
  const city = t?.properties?.city ?? null;
  const propertyType = t?.properties?.property_type ?? null;
  const { line1, subtitle } = splitPropertyLines(addr, city, propertyType);
  const fullAddress = normalizePropertyAddressLabel(addr ?? "") || null;

  const rentStatus = aggregateRentStatus(t?.rent_payments);

  const start = t?.start_date ? String(t.start_date).slice(0, 10) : null;
  const end = t?.end_date ? String(t.end_date).slice(0, 10) : null;

  return {
    id: row.id,
    fullName: row.full_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    propertyAddress: fullAddress,
    propertyLine1: line1,
    propertySubtitle: subtitle,
    rightToRentStatus: row.right_to_rent_status ?? null,
    tenancyStatus: t?.status ?? null,
    onboardingStatus: t?.onboarding_status ?? null,
    tenancyId: t?.id ? String(t.id) : null,
    leaseStartDate: start,
    leaseEndDate: end,
    leaseMonths: leaseMonthSpan(start, end),
    rentStatus,
    createdAt: row.created_at ?? null,
  };
}

export type TenantDetailRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  rightToRentStatus: string | null;
  createdAt: string | null;
  tenancies: Array<{
    id: string;
    status: string | null;
    startDate: string | null;
    propertyId: string | null;
    propertyAddress: string | null;
  }>;
};

export async function getTenantById(userId: string, tenantId: string): Promise<TenantDetailRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenants")
    .select(
      "id,full_name,email,phone,date_of_birth,right_to_rent_status,created_at,tenancies(id,status,start_date,property_id,properties(address))",
    )
    .eq("id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const rawTenancies = data.tenancies;
  const tenList = Array.isArray(rawTenancies)
    ? rawTenancies
    : rawTenancies
      ? [rawTenancies]
      : [];

  const tenancies = tenList.map((t) => {
    const row = t as {
      id?: string;
      status?: string | null;
      start_date?: string | null;
      property_id?: string | null;
      properties?: { address?: string | null } | null;
    };
    return {
      id: String(row.id ?? ""),
      status: row.status ?? null,
      startDate: row.start_date ?? null,
      propertyId: row.property_id ?? null,
      propertyAddress:
        normalizePropertyAddressLabel(row.properties?.address ?? "") || null,
    };
  });

  const dob = data.date_of_birth as string | null | undefined;

  return {
    id: data.id,
    fullName: data.full_name ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    dateOfBirth: dob ? String(dob).slice(0, 10) : null,
    rightToRentStatus: data.right_to_rent_status ?? null,
    createdAt: data.created_at ?? null,
    tenancies,
  };
}

/** Tenants linked to the auth user's properties via tenancies (contract picker). */
export type TenantPickListItem = {
  id: string;
  fullName: string | null;
  email: string | null;
};

export async function getTenantProfilesForContracts(): Promise<TenantPickListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: props } = await supabase.from("properties").select("id").eq("user_id", user.id);
  const propertyIds = (props ?? []).map((p) => p.id as string);
  if (propertyIds.length === 0) return [];

  const { data: tenancies, error: tenErr } = await supabase
    .from("tenancies")
    .select("tenant_id")
    .in("property_id", propertyIds);

  if (tenErr || !tenancies?.length) return [];

  const tenantIds = [
    ...new Set(
      tenancies
        .map((t) => t.tenant_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (tenantIds.length === 0) return [];

  const { data: profiles, error: profErr } = await supabase
    .from("tenants")
    .select("id,full_name,email")
    .in("id", tenantIds)
    .order("full_name", { ascending: true });

  if (profErr || !profiles) return [];

  return profiles.map((row) => ({
    id: row.id,
    fullName: row.full_name ?? null,
    email: row.email ?? null,
  }));
}

export async function addTenant(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "Not authenticated" };

  const parsed = tenantSchema.safeParse(formData);
  if (!parsed.success) return { ok: false as const, error: "Invalid form data" };

  const values = parsed.data;

  const { error } = await supabase.from("tenants").insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    full_name: values.fullName,
    email: values.email,
    phone: values.phone,
    date_of_birth: values.dateOfBirth,
    right_to_rent_status: values.rightToRentStatus,
  });

  if (error)
    return {
      ok: false as const,
      error: userFacingError(error.message, "We couldn't save that tenant. Please try again."),
    };

  revalidatePath("/dashboard/tenants");
  return { ok: true as const };
}

export async function updateTenant(tenantId: string, formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "Not authenticated" };

  const parsed = tenantUpdateSchema.safeParse(formData);
  if (!parsed.success) return { ok: false as const, error: "Invalid form data" };

  const values = parsed.data;
  const dob =
    values.dateOfBirth && values.dateOfBirth.trim().length > 0 ? values.dateOfBirth.trim() : null;

  const { error } = await supabase
    .from("tenants")
    .update({
      full_name: values.fullName,
      email: values.email,
      phone: values.phone,
      date_of_birth: dob,
      right_to_rent_status: values.rightToRentStatus,
    })
    .eq("id", tenantId)
    .eq("user_id", user.id);

  if (error)
    return {
      ok: false as const,
      error: userFacingError(error.message, "We couldn't save that tenant. Please try again."),
    };

  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${tenantId}`);
  return { ok: true as const };
}

