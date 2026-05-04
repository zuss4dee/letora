"use server";

import { revalidatePath } from "next/cache";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";
import { addLeadSchema, type AddLeadFormValues } from "@/lib/validations/leads";

export type LeadListRow = {
  id: string;
  /** Display: `name` if set, else `full_name` */
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  budget: number | null;
  moveInDate: string | null;
  qualifiedStatus: string;
  status: string;
  notes: string | null;
  createdAt: string | null;
  propertyAddress: string;
};

export type LeadPipelineStatus =
  | "new"
  | "contacted"
  | "viewing"
  | "applied"
  | "approved"
  | "rejected";

export type LeadQualifiedStatus = "pending" | "qualified" | "disqualified";

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function displayName(name: string | null, fullName: string | null): string {
  const n = name?.trim();
  if (n) return n;
  return fullName?.trim() || "—";
}

export async function getLeads(): Promise<LeadListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows, error } = await supabase
    .from("leads")
    .select(
      "id,name,full_name,email,phone,source,budget,move_in_date,qualified_status,status,notes,created_at,property_id,properties!inner(user_id)",
    )
    .eq("properties.user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !rows?.length) {
    if (error) console.warn("[getLeads]", error.message);
    return [];
  }

  const propertyIds = [
    ...new Set(
      rows.map((r) => r.property_id as string | null).filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: properties } =
    propertyIds.length > 0
      ? await supabase.from("properties").select("id, address").in("id", propertyIds)
      : { data: [] as { id: string; address: string | null }[] | null };

  const propById = new Map((properties ?? []).map((p) => [p.id, p] as const));

  return rows.map((row) => {
    const pid = row.property_id as string | null;
    const prop = pid ? propById.get(pid) : undefined;
    const rawAddr = prop?.address ?? "";
    const propertyAddress =
      normalizePropertyAddressLabel(rawAddr).trim() || "—";

    return {
      id: row.id as string,
      name: displayName(
        row.name as string | null,
        row.full_name as string | null,
      ),
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      source: (row.source as string | null) ?? null,
      budget: toNum(row.budget),
      moveInDate: row.move_in_date
        ? String(row.move_in_date).slice(0, 10)
        : null,
      qualifiedStatus: String(row.qualified_status ?? "pending").toLowerCase(),
      status: String(row.status ?? "new").toLowerCase(),
      notes: (row.notes as string | null) ?? null,
      createdAt: (row.created_at as string | null) ?? null,
      propertyAddress,
    };
  });
}

export async function addLead(data: AddLeadFormValues): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const parsed = addLeadSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join("; ") || "Invalid form data";
    throw new Error(msg);
  }

  const v = parsed.data;
  const trimmedName = v.name.trim();

  const { error } = await supabase.from("leads").insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    property_id: v.propertyId ?? null,
    name: trimmedName,
    full_name: trimmedName,
    email: v.email.trim(),
    phone: v.phone?.trim() ? v.phone.trim() : null,
    source: v.source ?? null,
    budget: v.budget ?? null,
    move_in_date: v.moveInDate?.trim() ? v.moveInDate.trim() : null,
    notes: v.notes?.trim() ? v.notes.trim() : null,
    status: "new",
    qualified_status: "pending",
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");
}

export async function updateLeadStatus(
  leadId: string,
  status: LeadPipelineStatus,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const allowed: LeadPipelineStatus[] = [
    "new",
    "contacted",
    "viewing",
    "applied",
    "approved",
    "rejected",
  ];
  if (!allowed.includes(status)) throw new Error("Invalid status");

  const { data, error } = await supabase
    .from("leads")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("user_id", user.id)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Lead not found");

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");
}

export async function updateLeadQualifiedStatus(
  leadId: string,
  qualifiedStatus: LeadQualifiedStatus,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const allowed: LeadQualifiedStatus[] = ["pending", "qualified", "disqualified"];
  if (!allowed.includes(qualifiedStatus)) throw new Error("Invalid qualified status");

  const { data, error } = await supabase
    .from("leads")
    .update({
      qualified_status: qualifiedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("user_id", user.id)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Lead not found");

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");
}

export async function deleteLead(leadId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("leads")
    .delete()
    .eq("id", leadId)
    .eq("user_id", user.id)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Lead not found");

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");
}
