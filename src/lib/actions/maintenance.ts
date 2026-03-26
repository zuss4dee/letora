"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { maintenanceRequestSchema } from "@/lib/validations/maintenance";

export type MaintenanceRequestRow = {
  id: string;
  propertyId: string | null;
  propertyAddress: string | null;
  tenantId: string | null;
  tenantFullName: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  createdAt: string | null;
};

export async function getMaintenanceRequests(userId: string): Promise<{
  open: MaintenanceRequestRow[];
  resolved: MaintenanceRequestRow[];
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("maintenance_requests")
    .select(
      "id,property_id,tenant_id,title,description,priority,status,created_at,properties!inner(address,user_id),tenant_profiles(full_name)",
    )
    .eq("properties.user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return { open: [], resolved: [] };

  const rows: MaintenanceRequestRow[] = data.map((row) => {
    const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    const tenant = Array.isArray(row.tenant_profiles) ? row.tenant_profiles[0] : row.tenant_profiles;
    return {
    id: row.id,
    propertyId: row.property_id ?? null,
    propertyAddress: property?.address ?? null,
    tenantId: row.tenant_id ?? null,
    tenantFullName: tenant?.full_name ?? null,
    title: row.title ?? null,
    description: row.description ?? null,
    priority: row.priority ?? null,
    status: row.status ?? null,
    createdAt: row.created_at ?? null,
  };
  });

  const open = rows.filter((r) => (r.status ?? "open") !== "resolved");
  const resolved = rows.filter((r) => (r.status ?? "open") === "resolved");

  return { open, resolved };
}

export async function addMaintenanceRequest(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "Not authenticated" };

  const parsed = maintenanceRequestSchema.safeParse(formData);
  if (!parsed.success) return { ok: false as const, error: "Invalid form data" };

  const values = parsed.data;

  const { error } = await supabase.from("maintenance_requests").insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    property_id: values.propertyId,
    tenant_id: values.tenantId,
    title: values.title,
    description: values.description,
    priority: values.priority,
    status: "open",
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard/maintenance");
  return { ok: true as const };
}

