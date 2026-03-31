"use server";

import { revalidatePath } from "next/cache";

import { addRentPaymentSchema } from "@/lib/validations/rent-tracker";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";

export type RentPaymentListRow = {
  id: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: string | null;
  notes: string | null;
  tenancyId: string | null;
  propertyAddress: string | null;
  tenantName: string | null;
};

function toAmount(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function unwrapNested<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function getRentPayments(): Promise<RentPaymentListRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("rent_payments")
    .select(
      `
      id,
      amount,
      due_date,
      paid_date,
      status,
      notes,
      created_at,
      tenancy_id,
      tenancies!inner (
        property_id,
        properties!inner ( address ),
        tenant_profiles ( full_name )
      )
    `,
    )
    .eq("user_id", user.id)
    .order("due_date", { ascending: false });

  if (error) {
    console.warn("[getRentPayments]", error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const tenancy = unwrapNested(
      row.tenancies as {
        properties?: { address?: string | null } | { address?: string | null }[];
        tenant_profiles?: { full_name?: string | null } | { full_name?: string | null }[];
      } | null,
    );
    const property = unwrapNested(tenancy?.properties as { address?: string | null } | null);
    const tenant = unwrapNested(tenancy?.tenant_profiles as { full_name?: string | null } | null);

    const addr = property?.address ?? "";
    return {
      id: row.id as string,
      amount: toAmount(row.amount),
      due_date: (row.due_date as string | null) ?? null,
      paid_date: (row.paid_date as string | null) ?? null,
      status: (row.status as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      tenancyId: (row.tenancy_id as string | null) ?? null,
      propertyAddress: normalizePropertyAddressLabel(addr) || null,
      tenantName: tenant?.full_name ?? null,
    };
  });
}

export async function addRentPayment(data: {
  tenancyId: string;
  amount: number;
  dueDate: string;
  notes?: string;
}): Promise<void> {
  const parsed = addRentPaymentSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid payment data");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .select("id,property_id,tenant_id,properties!inner(user_id)")
    .eq("id", parsed.data.tenancyId)
    .maybeSingle();

  if (tenancyError || !tenancy) {
    throw new Error("Tenancy not found");
  }

  const owner = unwrapNested(
    tenancy.properties as { user_id?: string } | { user_id?: string }[] | null,
  );
  if (owner?.user_id !== user.id) {
    throw new Error("Tenancy not found");
  }

  const { error } = await supabase.from("rent_payments").insert({
    user_id: user.id,
    tenancy_id: tenancy.id as string,
    property_id: tenancy.property_id as string,
    tenant_id: tenancy.tenant_id as string,
    amount: parsed.data.amount,
    due_date: parsed.data.dueDate,
    status: "pending",
    notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/rent-tracker");
  revalidatePath("/dashboard");
}

export async function markRentPaid(paymentId: string, paidDate: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("rent_payments")
    .update({
      paid_date: paidDate,
      status: "paid",
    })
    .eq("id", paymentId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/rent-tracker");
  revalidatePath("/dashboard");
}

export async function markRentOverdue(paymentId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("rent_payments")
    .update({ status: "overdue" })
    .eq("id", paymentId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/rent-tracker");
  revalidatePath("/dashboard");
}

export async function deleteRentPayment(paymentId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("rent_payments")
    .delete()
    .eq("id", paymentId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/rent-tracker");
}
