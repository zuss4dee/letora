"use server";

import { revalidatePath } from "next/cache";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";
import { tenantSchema, tenantUpdateSchema } from "@/lib/validations/tenant";

export type TenantRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  propertyAddress: string | null;
  rightToRentStatus: string | null;
  tenancyStatus: string | null;
  createdAt: string | null;
};

export async function getTenants(userId: string): Promise<TenantRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenant_profiles")
    .select(
      "id,full_name,email,phone,right_to_rent_status,created_at,tenancies(status,properties(address))",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => mapTenantListRow(row));
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
    status?: string | null;
    properties?: { address?: string | null } | null;
  }>;

  const firstTenancy = tenancies[0] ?? null;

  return {
    id: row.id,
    fullName: row.full_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    propertyAddress:
      normalizePropertyAddressLabel(firstTenancy?.properties?.address ?? "") || null,
    rightToRentStatus: row.right_to_rent_status ?? null,
    tenancyStatus: firstTenancy?.status ?? null,
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
    .from("tenant_profiles")
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
    .from("tenant_profiles")
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

  const { error } = await supabase.from("tenant_profiles").insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    full_name: values.fullName,
    email: values.email,
    phone: values.phone,
    date_of_birth: values.dateOfBirth,
    right_to_rent_status: values.rightToRentStatus,
  });

  if (error) return { ok: false as const, error: error.message };

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
    .from("tenant_profiles")
    .update({
      full_name: values.fullName,
      email: values.email,
      phone: values.phone,
      date_of_birth: dob,
      right_to_rent_status: values.rightToRentStatus,
    })
    .eq("id", tenantId)
    .eq("user_id", user.id);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${tenantId}`);
  return { ok: true as const };
}

