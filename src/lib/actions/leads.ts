"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { addLeadSchema } from "@/lib/validations/leads";

export type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  propertyInterestedIn: string | null;
  moveInDate: string | null;
  source: string | null;
  status: string | null;
};

type LeadBuckets = {
  new_leads: LeadRow[];
  qualified: LeadRow[];
  rejected: LeadRow[];
};

export async function getLeads(userId: string): Promise<LeadBuckets> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .select("id,full_name,email,phone,move_in_date,source,status,property_id,properties(address)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return { new_leads: [], qualified: [], rejected: [] };
  }

  const rows: LeadRow[] = data.map((row) => ({
    id: row.id,
    name: row.full_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    propertyInterestedIn: Array.isArray(row.properties)
      ? (row.properties[0] as { address?: string } | undefined)?.address ?? null
      : (row.properties as { address?: string } | null)?.address ?? null,
    moveInDate: row.move_in_date ?? null,
    source: row.source ?? null,
    status: row.status ?? null,
  }));

  return {
    new_leads: rows.filter((row) => {
      const status = (row.status ?? "new").toLowerCase();
      return status === "new" || status === "contacted";
    }),
    qualified: rows.filter((row) => (row.status ?? "new").toLowerCase() === "qualified"),
    rejected: rows.filter((row) => (row.status ?? "new").toLowerCase() === "rejected"),
  };
}

export async function addLead(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "Not authenticated" };

  const parsed = addLeadSchema.safeParse(formData);
  if (!parsed.success) return { ok: false as const, error: "Invalid form data" };

  const values = parsed.data;

  const { error } = await supabase.from("leads").insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    property_id: values.propertyId,
    full_name: values.fullName,
    email: values.email,
    phone: values.phone,
    move_in_date: values.moveInDate,
    source: values.source,
    notes: values.notes?.trim() ? values.notes : null,
    status: "new",
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard/leads");
  return { ok: true as const };
}

export async function updateLeadStatus(leadId: string, status: "qualified" | "rejected") {
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard/leads");
  return { ok: true as const };
}

