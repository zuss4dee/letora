"use server";

import { revalidatePath } from "next/cache";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";
import { tenantSchema, tenantUpdateSchema } from "@/lib/validations/tenant";
import { userFacingError } from "@/lib/user-facing-errors";
import { isPaymentOverdue, resolvePaymentAmount } from "@/lib/rent-utils";

export type TenantRentStatus = "paid" | "overdue" | "pending";

export type TenantRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  propertyAddress: string | null;
  propertyLine1: string | null;
  propertySubtitle: string | null;
  rightToRentStatus: string | null;
  tenancyStatus: string | null;
  onboardingStatus: string | null;
  tenancyId: string | null;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
  leaseMonths: number | null;
  rentStatus: TenantRentStatus;
  createdAt: string | null;
};

type TenancyEmbedRow = {
  id?: string;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  onboarding_status?: string | null;
  properties?: { address?: string | null; city?: string | null; property_type?: string | null } | null;
  rent_payments?: Array<{ status?: string | null; due_date?: string | null }> | null;
};

export async function getTenants(userId: string): Promise<TenantRow[]> {
  const supabase = await createClient();

  // Two-step load: PostgREST only discovers `tenants.tenancies(...)` when
  // `tenancies.tenant_id` FK targets `tenants.id`. If the DB still links to
  // `tenant_profiles` or has no FK, a nested select returns PGRST200.
  const { data: tenantRows, error: tenantErr } = await supabase
    .from("tenants")
    .select("id,full_name,email,phone,right_to_rent_status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (tenantErr) {
    console.error("[getTenants] tenants", {
      message: tenantErr.message,
      code: tenantErr.code,
      details: tenantErr.details,
    });
    return [];
  }

  const tenants = tenantRows ?? [];
  if (tenants.length === 0) return [];

  const ids = tenants.map((t) => String(t.id));
  const { data: tenancyRows, error: tenancyErr } = await supabase
    .from("tenancies")
    .select(
      `tenant_id,
      id,
      status,
      start_date,
      end_date,
      onboarding_status,
      properties(address,city,property_type),
      rent_payments(status,due_date)`,
    )
    .in("tenant_id", ids);

  if (tenancyErr) {
    console.error("[getTenants] tenancies", {
      message: tenancyErr.message,
      code: tenancyErr.code,
      details: tenancyErr.details,
    });
  }

  const byTenantId = new Map<string, TenancyEmbedRow[]>();
  for (const raw of tenancyRows ?? []) {
    const row = raw as { tenant_id?: string | null } & TenancyEmbedRow;
    const tid = row.tenant_id;
    if (!tid) continue;
    const { tenant_id: _tid, ...embed } = row;
    const list = byTenantId.get(tid) ?? [];
    list.push(embed);
    byTenantId.set(tid, list);
  }

  return tenants.map((row) =>
    mapTenantListRow({
      ...row,
      tenancies: byTenantId.get(String(row.id)) ?? [],
    }),
  );
}

function pickPrimaryTenancy(
  tenancies: Array<{
    id?: string;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    onboarding_status?: string | null;
    properties?: { address?: string | null; city?: string | null; property_type?: string | null } | null;
    rent_payments?: unknown;
  }>,
) {
  const list = Array.isArray(tenancies) ? tenancies : [];
  const active = list.filter((t) => (t.status ?? "").toLowerCase() === "active");
  const pool = active.length > 0 ? active : list;
  return pool.sort((a, b) => {
    const aStart = a.start_date ? new Date(a.start_date).getTime() : 0;
    const bStart = b.start_date ? new Date(b.start_date).getTime() : 0;
    return bStart - aStart;
  })[0] ?? null;
}

function aggregateRentStatus(payments: unknown): TenantRentStatus {
  const list = (Array.isArray(payments) ? payments : []) as Array<{
    status?: string | null;
    due_date?: string | null;
  }>;
  const todayIso = new Date().toISOString().slice(0, 10);

  if (list.some((p) => isPaymentOverdue(p.status ?? null, p.due_date ?? null, todayIso))) {
    return "overdue";
  }
  if (list.some((p) => (p.status ?? "").toLowerCase() === "pending")) {
    return "pending";
  }
  if (list.length > 0 && list.every((p) => (p.status ?? "").toLowerCase() === "paid")) {
    return "paid";
  }
  return "pending";
}

function splitPropertyLines(
  address: string | null,
  city: string | null,
  propertyType: string | null,
): { line1: string | null; subtitle: string | null } {
  const normalized = normalizePropertyAddressLabel(address ?? "");
  if (!normalized.trim()) {
    return {
      line1: null,
      subtitle: city?.trim() || propertyType?.trim() || null,
    };
  }
  const parts = normalized.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      line1: parts[0] ?? normalized,
      subtitle: parts.slice(1).join(", ") || city?.trim() || propertyType?.trim() || null,
    };
  }
  return {
    line1: normalized,
    subtitle: city?.trim() || propertyType?.trim() || null,
  };
}

function leaseMonthSpan(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return Math.max(0, months);
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
    id?: string;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    onboarding_status?: string | null;
    properties?: { address?: string | null; city?: string | null; property_type?: string | null } | null;
    rent_payments?: Array<{ status?: string | null; due_date?: string | null }> | null;
  }>;

  const t = pickPrimaryTenancy(tenancies);
  const addr = t?.properties?.address ?? null;
  const city = t?.properties?.city ?? null;
  const propertyType = t?.properties?.property_type ?? null;
  const { line1, subtitle } = splitPropertyLines(addr, city, propertyType);
  const fullAddress = normalizePropertyAddressLabel(addr ?? "") || null;

  const rentStatus = aggregateRentStatus(t?.rent_payments);

  const start = t?.start_date ? String(t.start_date).slice(0, 10) : null;
  const end = t?.end_date ? String(t.end_date).slice(0, 10) : null;

  return {
    id: row.id,
    fullName: row.full_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    propertyAddress: fullAddress,
    propertyLine1: line1,
    propertySubtitle: subtitle,
    rightToRentStatus: row.right_to_rent_status ?? null,
    tenancyStatus: t?.status ?? null,
    onboardingStatus: t?.onboarding_status ?? null,
    tenancyId: t?.id ? String(t.id) : null,
    leaseStartDate: start,
    leaseEndDate: end,
    leaseMonths: leaseMonthSpan(start, end),
    rentStatus,
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
    endDate: string | null;
    propertyId: string | null;
    propertyAddress: string | null;
    monthlyRent: number | null;
  }>;
};

export async function getTenantById(userId: string, tenantId: string): Promise<TenantDetailRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id,full_name,email,phone,date_of_birth,right_to_rent_status,created_at")
    .eq("id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const { data: tenancyRows, error: tenancyErr } = await supabase
    .from("tenancies")
    .select("id,status,start_date,end_date,monthly_rent,property_id,properties(address)")
    .eq("tenant_id", tenantId);

  if (tenancyErr) {
    console.error("[getTenantById] tenancies", {
      message: tenancyErr.message,
      code: tenancyErr.code,
    });
  }

  const tenList = tenancyRows ?? [];

  const tenancies = tenList.map((t) => {
    const row = t as {
      id?: string;
      status?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      monthly_rent?: number | null;
      property_id?: string | null;
      properties?: { address?: string | null } | null;
    };
    return {
      id: String(row.id ?? ""),
      status: row.status ?? null,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      monthlyRent: row.monthly_rent ?? null,
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

export type TenantProfileActivityRow = {
  id: string;
  tool_name: string;
  args: unknown;
  result: unknown;
  success: boolean;
  created_at: string;
  source: string | null;
};

export type TenantProfileLastPayment = {
  amountGbp: number;
  /** ISO date string (YYYY-MM-DD) when known */
  dateIso: string | null;
};

function pickLastPaidPayment(
  rows: Array<{
    amount?: unknown;
    status?: string | null;
    paid_date?: string | null;
    created_at?: string | null;
  }>,
): TenantProfileLastPayment | null {
  const paid = rows.filter((p) => (p.status ?? "").toLowerCase() === "paid");
  if (paid.length === 0) return null;

  const sorted = [...paid].sort((a, b) => {
    const ta = new Date(a.paid_date ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.paid_date ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });

  const top = sorted[0];
  const amountGbp = resolvePaymentAmount(top);
  const dateIso = top.paid_date
    ? String(top.paid_date).slice(0, 10)
    : top.created_at
      ? String(top.created_at).slice(0, 10)
      : null;

  return { amountGbp, dateIso };
}

export type TenantProfileOperationalData = {
  tenant: TenantDetailRow;
  activeTenancy: TenantDetailRow["tenancies"][0] | null;
  rent: {
    /** Contract rent for active/primary tenancy; null when not set in DB */
    monthlyRentGbp: number | null;
    arrearsGbp: number;
    status: TenantRentStatus;
    lastPaid: TenantProfileLastPayment | null;
  };
  maintenance: {
    openCount: number;
  };
  approvals: {
    pendingCount: number;
  };
  activity: TenantProfileActivityRow[];
};

export async function getTenantProfileOperationalData(
  userId: string,
  tenantId: string
): Promise<TenantProfileOperationalData | null> {
  const supabase = await createClient();

  const tenant = await getTenantById(userId, tenantId);
  if (!tenant) return null;

  const activeTenancy =
    tenant.tenancies.find((t) => (t.status ?? "").toLowerCase() === "active") ?? tenant.tenancies[0] ?? null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const tenancyIds = tenant.tenancies.map((t) => t.id);
  const targetIdList = [tenantId, ...tenancyIds];

  const emptyMaint = Promise.resolve({ data: [] as { id: string }[], error: null });
  const zeroCount = Promise.resolve({ count: 0, error: null as null });

  const [
    rentPaymentsResult,
    openMaintResult,
    maintRowsResult,
    activityResult,
    apprTargetsResult,
    apprRentChaseResult,
  ] = await Promise.all([
    supabase
      .from("rent_payments")
      .select("amount, status, due_date, paid_date, created_at")
      .eq("tenant_id", tenantId),
    tenancyIds.length > 0
      ? supabase
          .from("maintenance_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
          .in("tenancy_id", tenancyIds)
      : zeroCount,
    tenancyIds.length > 0
      ? supabase.from("maintenance_requests").select("id").in("tenancy_id", tenancyIds)
      : emptyMaint,
    supabase
      .from("agent_activity")
      .select("id,tool_name,args,result,success,created_at,source")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    targetIdList.length > 0
      ? supabase
          .from("agent_approvals")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "pending")
          .in("target_id", targetIdList)
      : zeroCount,
    supabase
      .from("agent_approvals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("action_type", "send_rent_chase_email")
      .eq("payload->>tenantId", tenantId),
  ]);

  const rentPayments = rentPaymentsResult.data ?? [];
  if (rentPaymentsResult.error) {
    console.warn("[getTenantProfileOperationalData] rent_payments", rentPaymentsResult.error.message);
  }

  const arrearsGbp = rentPayments.reduce((acc, p) => {
    if (!isPaymentOverdue(p.status, p.due_date, todayIso)) return acc;
    return acc + resolvePaymentAmount(p);
  }, 0);

  const rentStatus = aggregateRentStatus(rentPayments);
  const lastPaid = pickLastPaidPayment(rentPayments);

  const openMaintenanceCount =
    tenancyIds.length > 0 ? (openMaintResult as { count: number | null }).count ?? 0 : 0;
  if (tenancyIds.length > 0 && "error" in openMaintResult && openMaintResult.error) {
    console.warn(
      "[getTenantProfileOperationalData] maintenance open count",
      openMaintResult.error.message,
    );
  }

  const maintenanceIds = (maintRowsResult.data ?? []).map((m) => String(m.id)).filter(Boolean);

  let pendingApprovalsCount = 0;

  if ("error" in apprTargetsResult && apprTargetsResult.error) {
    console.warn(
      "[getTenantProfileOperationalData] pending approvals count (targets)",
      apprTargetsResult.error.message,
    );
  } else {
    pendingApprovalsCount += (apprTargetsResult as { count: number | null }).count ?? 0;
  }

  if (apprRentChaseResult.error) {
    console.warn(
      "[getTenantProfileOperationalData] pending approvals count (rent chase)",
      apprRentChaseResult.error.message,
    );
  } else {
    pendingApprovalsCount += apprRentChaseResult.count ?? 0;
  }

  if (maintenanceIds.length > 0) {
    const { count: c3, error: e3 } = await supabase
      .from("agent_approvals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("action_type", "approve_maintenance_dispatch")
      .in("target_id", maintenanceIds);
    if (e3) {
      console.warn("[getTenantProfileOperationalData] pending approvals count (maintenance)", e3.message);
    } else {
      pendingApprovalsCount += c3 ?? 0;
    }
  }

  if (activityResult.error) {
    console.warn("[getTenantProfileOperationalData] agent_activity", activityResult.error.message);
  }

  const tenantActivity: TenantProfileActivityRow[] = (activityResult.data ?? [])
    .map((row) => {
      const r = row as Record<string, unknown>;
      const id = r.id != null ? String(r.id) : "";
      const tool_name = typeof r.tool_name === "string" ? r.tool_name : "";
      const created_at = typeof r.created_at === "string" ? r.created_at : "";
      const success = typeof r.success === "boolean" ? r.success : true;
      const source = r.source == null ? null : String(r.source);
      if (!id || !tool_name || !created_at) return null;
      return {
        id,
        tool_name,
        args: r.args,
        result: r.result,
        success,
        created_at,
        source,
      } satisfies TenantProfileActivityRow;
    })
    .filter((row): row is TenantProfileActivityRow => row != null)
    .filter((a) => {
      const argsStr = JSON.stringify(a.args);
      return argsStr.includes(tenantId) || tenant.tenancies.some((t) => argsStr.includes(t.id));
    });

  return {
    tenant,
    activeTenancy,
    rent: {
      monthlyRentGbp: activeTenancy?.monthlyRent ?? null,
      arrearsGbp,
      status: rentStatus,
      lastPaid,
    },
    maintenance: {
      openCount: openMaintenanceCount,
    },
    approvals: {
      pendingCount: pendingApprovalsCount,
    },
    activity: tenantActivity,
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
    .from("tenants")
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

  const dob =
    values.dateOfBirth && values.dateOfBirth.trim().length > 0 ? values.dateOfBirth.trim() : null;

  const tenantId = crypto.randomUUID();
  const { error } = await supabase.from("tenants").insert({
    id: tenantId,
    user_id: user.id,
    full_name: values.fullName,
    email: values.email,
    phone: values.phone,
    date_of_birth: dob,
    right_to_rent_status: values.rightToRentStatus,
  });

  if (error) {
    const raw = error.message ?? "";
    const code = error.code ?? "";

    console.error("[addTenant]", { code, message: raw, details: error.details });

    if (code === "23505" || /duplicate key|unique constraint/i.test(raw)) {
      return {
        ok: false as const,
        error:
          "A tenant with this email already exists for your account. Edit that profile or use a different email.",
      };
    }
    if (code === "42501" || /row-level security/i.test(raw)) {
      return {
        ok: false as const,
        error: "We couldn’t authorize that save with your current session. Refresh the page and try again.",
      };
    }
    if (/relation ["']public\.tenants["'] does not exist|could not find the table.*tenants/i.test(raw)) {
      return {
        ok: false as const,
        error:
          "The tenant database table is missing or out of date. Apply pending Supabase migrations (tenants / tenant_profiles rename), then try again.",
      };
    }

    return {
      ok: false as const,
      error: userFacingError(raw, "We couldn't save that tenant. Please try again."),
    };
  }

  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${tenantId}`);
  return { ok: true as const, tenantId };
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
    .from("tenants")
    .update({
      full_name: values.fullName,
      email: values.email,
      phone: values.phone,
      date_of_birth: dob,
      right_to_rent_status: values.rightToRentStatus,
    })
    .eq("id", tenantId)
    .eq("user_id", user.id);

  if (error) {
    const raw = error.message ?? "";
    const code = error.code ?? "";
    console.error("[updateTenant]", { code, message: raw, details: error.details });

    if (code === "23505" || /duplicate key|unique constraint/i.test(raw)) {
      return {
        ok: false as const,
        error: "Another tenant already uses this email. Choose a different email address.",
      };
    }
    if (code === "42501" || /row-level security/i.test(raw)) {
      return {
        ok: false as const,
        error: "We couldn’t authorize that save with your current session. Refresh the page and try again.",
      };
    }

    return {
      ok: false as const,
      error: userFacingError(raw, "We couldn't save that tenant. Please try again."),
    };
  }

  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${tenantId}`);
  return { ok: true as const };
}

