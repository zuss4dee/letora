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
  createdAt: string | null;
};

export async function getProperties(userId: string): Promise<PropertyRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("properties")
    .select(
      "id,address,postcode,city,property_type,bedrooms,bathrooms,monthly_rent,status,created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    address: row.address ?? null,
    postcode: row.postcode ?? null,
    city: row.city ?? null,
    propertyType: row.property_type ?? null,
    bedrooms: row.bedrooms ?? null,
    bathrooms: row.bathrooms ?? null,
    monthlyRent:
      row.monthly_rent == null
        ? null
        : typeof row.monthly_rent === "number"
          ? row.monthly_rent
          : Number(row.monthly_rent),
    status: row.status ?? null,
    createdAt: row.created_at ?? null,
  }));
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

