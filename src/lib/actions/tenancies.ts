"use server";

import { revalidatePath } from "next/cache";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";
import {
  addTenancySchema,
  logPaymentSchema,
  updateTenancySchema,
} from "@/lib/validations/tenancy";

export type TenancyRow = {
  id: string;
  propertyId: string | null;
  propertyAddress: string | null;
  tenantId: string | null;
  tenantFullName: string | null;
  startDate: string | null;
  endDate: string | null;
  moveInDate: string | null;
  monthlyRent: number | null;
  depositAmount: number | null;
  status: string | null;
};

export type RentPaymentRow = {
  id: string;
  tenancyId: string | null;
  propertyAddress: string | null;
  tenantFullName: string | null;
  dueDate: string | null;
  amountDue: number | null;
  amountPaid: number | null;
  status: string | null;
};

function monthRangeUtc(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const startDate = start.toISOString().slice(0, 10);
  const nextDate = next.toISOString().slice(0, 10);
  return { startDate, nextDate, start };
}

function computeDueDateForMonth(startDateIso: string, monthStart: Date) {
  const start = new Date(`${startDateIso}T00:00:00.000Z`);
  const day = start.getUTCDate();
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  const due = new Date(Date.UTC(year, month, clampedDay));
  return due.toISOString().slice(0, 10);
}

export async function getTenancies(userId: string): Promise<TenancyRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenancies")
    .select(
      "id,property_id,tenant_id,start_date,end_date,move_in_date,monthly_rent,deposit_amount,status,properties!inner(address,user_id),tenants(full_name)",
    )
    .eq("properties.user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => {
    const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    return {
    id: row.id,
    propertyId: row.property_id ?? null,
    propertyAddress: normalizePropertyAddressLabel(property?.address ?? "") || null,
    tenantId: row.tenant_id ?? null,
    tenantFullName: tenant?.full_name ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    moveInDate: row.move_in_date ?? null,
    monthlyRent:
      row.monthly_rent == null
        ? null
        : typeof row.monthly_rent === "number"
          ? row.monthly_rent
          : Number(row.monthly_rent),
    depositAmount:
      row.deposit_amount == null
        ? null
        : typeof row.deposit_amount === "number"
          ? row.deposit_amount
          : Number(row.deposit_amount),
    status: row.status ?? null,
  };
  });
}

export async function updateTenancy(
  tenancyId: string,
  data: unknown,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    return { success: false, error: "Not authenticated" };
  }

  const parsed = updateTenancySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Invalid form data" };
  }

  const values = parsed.data;

  const { data: row, error: fetchError } = await supabase
    .from("tenancies")
    .select("id, properties!inner ( user_id )")
    .eq("id", tenancyId)
    .maybeSingle();

  if (fetchError || !row) {
    return { success: false, error: "Tenancy not found" };
  }

  const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
  const ownerId = property?.user_id as string | undefined;
  if (!ownerId || ownerId !== user.id) {
    return { success: false, error: "Not found" };
  }

  const { error: updateError } = await supabase
    .from("tenancies")
    .update({
      start_date: values.startDate,
      end_date: values.endDate,
      move_in_date: values.moveInDate?.trim() ? values.moveInDate : null,
      monthly_rent: values.monthlyRent,
      deposit_amount: values.depositAmount,
      status: values.status,
    })
    .eq("id", tenancyId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/dashboard/tenancies");
  revalidatePath(`/dashboard/tenancies/${tenancyId}`);
  revalidatePath("/dashboard/rent-tracker");
  return { success: true };
}

export async function addTenancy(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "Not authenticated" };

  const parsed = addTenancySchema.safeParse(formData);
  if (!parsed.success) return { ok: false as const, error: "Invalid form data" };

  const values = parsed.data;

  const { error } = await supabase.from("tenancies").insert({
    id: crypto.randomUUID(),
    property_id: values.propertyId,
    tenant_id: values.tenantId,
    start_date: values.startDate,
    end_date: values.endDate,
    move_in_date: values.moveInDate?.trim() || null,
    monthly_rent: values.monthlyRent,
    deposit_amount: values.depositAmount,
    status: "active",
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard/tenancies");
  revalidatePath("/dashboard/rent-tracker");
  return { ok: true as const };
}

export async function getThisMonthPayments(userId: string): Promise<RentPaymentRow[]> {
  const supabase = await createClient();
  const { startDate, nextDate } = monthRangeUtc();

  const { data, error } = await supabase
    .from("rent_payments")
    .select(
      "id,tenancy_id,due_date,amount_due,amount_paid,status,tenancies!inner(properties!inner(address,user_id),tenants(full_name))",
    )
    .eq("tenancies.properties.user_id", userId)
    .gte("due_date", startDate)
    .lt("due_date", nextDate)
    .order("due_date", { ascending: true });

  if (error) return [];

  return (data ?? []).map((row) => {
    const tenancy = Array.isArray(row.tenancies) ? row.tenancies[0] : row.tenancies;
    const property = tenancy
      ? Array.isArray(tenancy.properties)
        ? tenancy.properties[0]
        : tenancy.properties
      : null;
    const tenant = tenancy
      ? Array.isArray(tenancy.tenants)
        ? tenancy.tenants[0]
        : tenancy.tenants
      : null;
    return {
    id: row.id,
    tenancyId: row.tenancy_id ?? null,
    propertyAddress: normalizePropertyAddressLabel(property?.address ?? "") || null,
    tenantFullName: tenant?.full_name ?? null,
    dueDate: row.due_date ?? null,
    amountDue:
      row.amount_due == null
        ? null
        : typeof row.amount_due === "number"
          ? row.amount_due
          : Number(row.amount_due),
    amountPaid:
      row.amount_paid == null
        ? null
        : typeof row.amount_paid === "number"
          ? row.amount_paid
          : Number(row.amount_paid),
    status: row.status ?? null,
  };
  });
}

export async function autoGeneratePendingPayments(userId: string) {
  const supabase = await createClient();
  const { startDate, nextDate, start } = monthRangeUtc();

  const { data: tenancies, error: tenanciesError } = await supabase
    .from("tenancies")
    .select("id,start_date,monthly_rent,properties!inner(user_id)")
    .eq("properties.user_id", userId)
    .eq("status", "active");

  if (tenanciesError || !tenancies?.length) return { ok: true as const };

  const { data: existingPayments, error: existingError } = await supabase
    .from("rent_payments")
    .select("tenancy_id")
    .gte("due_date", startDate)
    .lt("due_date", nextDate)
    .in(
      "tenancy_id",
      tenancies.map((t) => t.id),
    );

  if (existingError) return { ok: false as const, error: existingError.message };

  const existingSet = new Set((existingPayments ?? []).map((p) => p.tenancy_id));

  const toInsert = tenancies
    .filter((t) => !existingSet.has(t.id))
    .map((t) => ({
      id: crypto.randomUUID(),
      tenancy_id: t.id,
      due_date: t.start_date ? computeDueDateForMonth(t.start_date, start) : startDate,
      amount_due:
        t.monthly_rent == null
          ? 0
          : typeof t.monthly_rent === "number"
            ? t.monthly_rent
            : Number(t.monthly_rent),
      amount_paid: null,
      paid_on: null,
      status: "pending",
    }));

  if (toInsert.length === 0) return { ok: true as const };

  const { error } = await supabase.from("rent_payments").insert(toInsert);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard/tenancies");
  revalidatePath("/dashboard/rent-tracker");
  return { ok: true as const };
}

export async function logPayment(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "Not authenticated" };

  const parsed = logPaymentSchema.safeParse(formData);
  if (!parsed.success) return { ok: false as const, error: "Invalid form data" };

  const values = parsed.data;

  if (values.rentPaymentId) {
    const { error } = await supabase
      .from("rent_payments")
      .update({
        amount_paid: values.amountPaid,
        paid_on: values.paidOn,
        status: "paid",
        payment_method: values.paymentMethod,
        notes: values.notes ?? null,
      })
      .eq("id", values.rentPaymentId);

    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await supabase.from("rent_payments").insert({
      id: crypto.randomUUID(),
      tenancy_id: values.tenancyId,
      due_date: values.paidOn,
      amount_due: values.amountPaid,
      amount_paid: values.amountPaid,
      paid_on: values.paidOn,
      status: "paid",
      payment_method: values.paymentMethod,
      notes: values.notes ?? null,
    });

    if (error) return { ok: false as const, error: error.message };
  }

  revalidatePath("/dashboard/tenancies");
  revalidatePath("/dashboard/rent-tracker");
  return { ok: true as const };
}

