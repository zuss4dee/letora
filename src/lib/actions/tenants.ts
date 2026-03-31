"use server";

import { revalidatePath } from "next/cache";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";
import { tenantSchema } from "@/lib/validations/tenant";

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

  return (data ?? []).map((row) => {
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
  });
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

