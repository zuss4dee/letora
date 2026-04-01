"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { propertySchema } from "@/lib/validations/property";

export type PropertyRow = {
  id: string;
  address: string | null;
  postcode: string | null;
  city: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  monthlyRent: number | null;
  status: string | null;
  marketingDescription: string | null;
  createdAt: string | null;
};

export async function getProperties(userId: string): Promise<PropertyRow[]> {
  const supabase = await createClient();

  /** Use `*` so listing works even if optional columns (e.g. marketing_description) are missing on older DBs. */
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getProperties]", error.message, error.code, error.details);
    return [];
  }

  return (data ?? []).map((row) => mapPropertyRow(row as Record<string, unknown>));
}

function mapPropertyRow(r: Record<string, unknown>): PropertyRow {
  const monthlyRaw = r.monthly_rent;
  return {
    id: String(r.id),
    address: (r.address as string | null | undefined) ?? null,
    postcode: (r.postcode as string | null | undefined) ?? null,
    city: (r.city as string | null | undefined) ?? null,
    propertyType: (r.property_type as string | null | undefined) ?? null,
    bedrooms: (r.bedrooms as number | null | undefined) ?? null,
    bathrooms: (r.bathrooms as number | null | undefined) ?? null,
    monthlyRent:
      monthlyRaw == null
        ? null
        : typeof monthlyRaw === "number"
          ? monthlyRaw
          : Number(monthlyRaw),
    status: (r.status as string | null | undefined) ?? null,
    marketingDescription: (r.marketing_description as string | null | undefined) ?? null,
    createdAt: (r.created_at as string | null | undefined) ?? null,
  };
}

export async function getPropertyById(userId: string, propertyId: string): Promise<PropertyRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapPropertyRow(data as Record<string, unknown>);
}

export type PropertyTenancyListItem = {
  id: string;
  status: string | null;
  startDate: string | null;
  tenantName: string | null;
};

export async function getTenanciesForProperty(
  userId: string,
  propertyId: string,
): Promise<PropertyTenancyListItem[]> {
  const supabase = await createClient();
  const ok = await getPropertyById(userId, propertyId);
  if (!ok) return [];

  const { data, error } = await supabase
    .from("tenancies")
    .select("id, status, start_date, tenant_profiles(full_name)")
    .eq("property_id", propertyId)
    .order("start_date", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const tp = row.tenant_profiles as { full_name?: string | null } | null;
    return {
      id: row.id as string,
      status: (row.status as string | null) ?? null,
      startDate: (row.start_date as string | null) ?? null,
      tenantName: tp?.full_name ?? null,
    };
  });
}

/** `id` and `address` only, for the authenticated user (e.g. contract picker). */
export type PropertyPickListItem = {
  id: string;
  address: string | null;
};

export async function getPropertyPickList(): Promise<PropertyPickListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("properties")
    .select("id,address")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    address: row.address ?? null,
  }));
}

export async function addProperty(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Not authenticated" };
  }

  const parsed = propertySchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid form data" };
  }

  const values = parsed.data;

  const { error } = await supabase.from("properties").insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    address: values.address,
    postcode: values.postcode,
    city: values.city,
    property_type: values.propertyType,
    bedrooms: values.bedrooms,
    bathrooms: values.bathrooms,
    monthly_rent: values.monthlyRent,
    status: values.status,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/dashboard/properties");
  return { ok: true as const };
}

export async function updateProperty(propertyId: string, formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Not authenticated" };
  }

  const parsed = propertySchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid form data" };
  }

  const values = parsed.data;

  const { error } = await supabase
    .from("properties")
    .update({
      address: values.address,
      postcode: values.postcode,
      city: values.city,
      property_type: values.propertyType,
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      monthly_rent: values.monthlyRent,
      status: values.status,
    })
    .eq("id", propertyId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/dashboard/properties");
  revalidatePath(`/dashboard/properties/${propertyId}`);
  return { ok: true as const };
}

