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

export type PropertyPortfolioRow = PropertyRow & {
  occupancyPct: number;
  yieldPctLabel: string;
  yieldTierLabel: string;
  maintenanceState: "optimal" | "attention";
  maintenanceDetail: string;
  lastActionTitle: string;
  lastActionAt: string | null;
  identityTitle: string;
  identitySubline: string;
};

/** Illustrative yield % until property valuations exist in the data model. */
function hashToYieldPct(propertyId: string, monthlyRent: number | null): string {
  if (monthlyRent == null || monthlyRent <= 0) return "—";
  let h = 0;
  for (let i = 0; i < propertyId.length; i++) {
    h = (h * 31 + propertyId.charCodeAt(i)) >>> 0;
  }
  const base = 3.4 + (h % 48) / 10;
  return `${Math.min(8.9, Math.max(3.2, base)).toFixed(1)}%`;
}

function yieldTierLabel(propertyType: string | null, monthlyRent: number | null): string {
  if (monthlyRent == null || monthlyRent <= 0) return "Awaiting rent";
  const t = (propertyType ?? "").toLowerCase();
  if (t.includes("house")) return "High Growth";
  if (t.includes("flat")) return "Core Portfolio";
  if (t.includes("terraced") || t.includes("semi")) return "Stabilized Asset";
  return "Core Portfolio";
}

function splitIdentity(address: string | null, city: string | null, postcode: string | null) {
  const raw = (address ?? "").trim();
  if (!raw) {
    return {
      title: "Untitled property",
      subline: [city, postcode].filter(Boolean).join(" · ").toUpperCase() || "—",
    };
  }
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const title = parts.length > 1 ? parts[0]! : raw;
  const rest = parts.length > 1 ? parts.slice(1).join(", ") : [city, postcode].filter(Boolean).join(", ");
  return {
    title,
    subline: (rest || [city, postcode].filter(Boolean).join(" · ")).toUpperCase() || "—",
  };
}

/** Enriched property rows for the Managed Properties registry (stitch layout). */
export async function getPropertiesPortfolio(userId: string): Promise<PropertyPortfolioRow[]> {
  const list = await getProperties(userId);
  if (list.length === 0) return [];

  const supabase = await createClient();
  const ids = list.map((p) => p.id);

  const { data: tenRows } = await supabase
    .from("tenancies")
    .select("property_id, status, start_date, created_at")
    .in("property_id", ids);

  const { data: maintRows } = await supabase
    .from("maintenance_requests")
    .select("id, status, created_at, description, tenancies(property_id)");

  const tenancies = (tenRows ?? []) as Array<{
    property_id?: string;
    status?: string | null;
    start_date?: string | null;
    created_at?: string | null;
  }>;

  const maintenance = (maintRows ?? []) as Array<{
    id?: string;
    status?: string | null;
    created_at?: string | null;
    description?: string | null;
    tenancies?: { property_id?: string } | { property_id?: string }[] | null;
  }>;

  function tenancyPropertyId(m: (typeof maintenance)[0]): string | null {
    const t = m.tenancies;
    if (!t) return null;
    const row = Array.isArray(t) ? t[0] : t;
    return row?.property_id ?? null;
  }

  return list.map((p) => {
    const { title, subline } = splitIdentity(p.address, p.city, p.postcode);

    const propTenancies = tenancies.filter((t) => t.property_id === p.id);
    const activeTenancies = propTenancies.filter(
      (t) => (t.status ?? "").toLowerCase() === "active",
    );
    const vacant = (p.status ?? "").toLowerCase() === "vacant";
    const occupancyPct = vacant ? 0 : activeTenancies.length > 0 ? 100 : 0;

    const propMaint = maintenance.filter((m) => tenancyPropertyId(m) === p.id);
    const openMaint = propMaint.filter((m) => (m.status ?? "open") !== "resolved");
    const latestOpen = openMaint.sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
    )[0];
    const latestAny = propMaint.sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
    )[0];

    const maintenanceState: "optimal" | "attention" = openMaint.length > 0 ? "attention" : "optimal";
    const maintenanceDetail =
      openMaint.length > 0
        ? latestOpen?.description?.trim()
          ? `${latestOpen.description.trim().slice(0, 42)}${latestOpen.description.length > 42 ? "…" : ""}`
          : `Open ticket #${(latestOpen?.id ?? "").slice(0, 6)}`
        : latestAny?.status === "resolved"
          ? "Audit complete"
          : "No open issues";

    const primaryTenancy = activeTenancies.sort(
      (a, b) =>
        new Date(b.start_date ?? b.created_at ?? 0).getTime() -
        new Date(a.start_date ?? a.created_at ?? 0).getTime(),
    )[0];

    let lastActionTitle = "Property profile";
    let lastActionAt: string | null = p.createdAt ?? null;

    if (openMaint.length > 0 && latestOpen?.created_at) {
      lastActionTitle = "Service call";
      lastActionAt = latestOpen.created_at;
    } else if (primaryTenancy) {
      lastActionTitle = "Lease active";
      lastActionAt = primaryTenancy.start_date ?? primaryTenancy.created_at ?? p.createdAt ?? null;
    }

    return {
      ...p,
      occupancyPct,
      yieldPctLabel: hashToYieldPct(p.id, p.monthlyRent),
      yieldTierLabel: yieldTierLabel(p.propertyType, p.monthlyRent),
      maintenanceState,
      maintenanceDetail,
      lastActionTitle,
      lastActionAt,
      identityTitle: title,
      identitySubline: subline,
    };
  });
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
    .select("id, status, start_date, tenants(full_name)")
    .eq("property_id", propertyId)
    .order("start_date", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const tp = row.tenants as { full_name?: string | null } | null;
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

