"use server";

import { revalidatePath } from "next/cache";

import { runMaintenanceAgent } from "@/lib/agents/maintenance-agent";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";
import { assignContractorSchema, maintenanceRequestSchema } from "@/lib/validations/maintenance";

type TenancyJoinRow = {
  property_id: string | null;
  tenant_id: string | null;
  properties: {
    address: string | null;
    user_id?: string;
  } | null;
  tenants: { full_name: string | null; email?: string | null } | null;
};

function unwrapTenancy(row: { tenancies?: unknown }): TenancyJoinRow | null {
  const t = row.tenancies as TenancyJoinRow | TenancyJoinRow[] | null | undefined;
  if (!t) return null;
  return Array.isArray(t) ? t[0] ?? null : t;
}

export type MaintenanceRequestRow = {
  id: string;
  tenancyId: string | null;
  propertyId: string | null;
  propertyAddress: string | null;
  tenantId: string | null;
  tenantFullName: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
  contractorName: string | null;
  contractorEmail: string | null;
  aiTriageCategory: string | null;
  aiTriageSummary: string | null;
};

export type MaintenanceEmailLogRow = {
  id: string;
  subject: string | null;
  status: string | null;
  to_email: string | null;
  to_name: string | null;
  sent_at: string | null;
  created_at: string | null;
};

/** Terminal maintenance rows (agent seed + manual updates may use `completed` vs `resolved`). */
function isMaintenanceResolvedStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "resolved" || s === "completed";
}

export type MaintenanceDetail = MaintenanceRequestRow & {
  updatedAt: string | null;
  tenantEmail: string | null;
  tenantAcknowledgedAt: string | null;
  landlordNotifiedAt: string | null;
  triageFromRun: {
    responseTime?: string;
    recommendedAction?: string;
  } | null;
  maintenanceAgentRunId: string | null;
  emailLogs: MaintenanceEmailLogRow[];
};

export async function getMaintenanceRequests(userId: string): Promise<{
  open: MaintenanceRequestRow[];
  resolved: MaintenanceRequestRow[];
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("maintenance_requests")
    .select(
      "id,tenancy_id,description,priority,status,created_at,resolved_at,contractor_name,contractor_email,ai_triage_category,ai_triage_summary,tenancies!inner(property_id,tenant_id,properties!inner(address,user_id),tenants(full_name))",
    )
    .eq("tenancies.properties.user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return { open: [], resolved: [] };

  const rows: MaintenanceRequestRow[] = data.map((row) => {
    const tenancy = unwrapTenancy(row);
    const property = tenancy?.properties
      ? Array.isArray(tenancy.properties)
        ? tenancy.properties[0]
        : tenancy.properties
      : null;
    const tenant = tenancy?.tenants
      ? Array.isArray(tenancy.tenants)
        ? tenancy.tenants[0]
        : tenancy.tenants
      : null;
    const desc = row.description as string | null;
    return {
      id: row.id as string,
      tenancyId: (row.tenancy_id as string | null) ?? null,
      propertyId: tenancy?.property_id ?? null,
      propertyAddress: normalizePropertyAddressLabel(property?.address ?? "") || null,
      tenantId: tenancy?.tenant_id ?? null,
      tenantFullName: tenant?.full_name ?? null,
      description: desc,
      priority: row.priority ?? null,
      status: row.status ?? null,
      createdAt: row.created_at ?? null,
      resolvedAt: (row.resolved_at as string | null) ?? null,
      contractorName: (row.contractor_name as string | null) ?? null,
      contractorEmail: (row.contractor_email as string | null) ?? null,
      aiTriageCategory: row.ai_triage_category ?? null,
      aiTriageSummary: row.ai_triage_summary ?? null,
    };
  });

  const open = rows.filter((r) => !isMaintenanceResolvedStatus(r.status));
  const resolved = rows.filter((r) => isMaintenanceResolvedStatus(r.status));

  return { open, resolved };
}

export async function getMaintenanceRequestDetail(
  userId: string,
  requestId: string,
): Promise<MaintenanceDetail | null> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("maintenance_requests")
    .select(
      "id,tenancy_id,description,priority,status,created_at,updated_at,resolved_at,contractor_name,contractor_email,ai_triage_category,ai_triage_summary,tenant_acknowledged_at,landlord_notified_at,tenancies!inner(property_id,tenant_id,properties!inner(address,user_id),tenants(full_name,email))",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error || !row) return null;

  const tenancy = unwrapTenancy(row);
  const property = tenancy?.properties
    ? Array.isArray(tenancy.properties)
      ? tenancy.properties[0]
      : tenancy.properties
    : null;
  if (!property || property.user_id !== userId) return null;

  const tenant = tenancy?.tenants
    ? Array.isArray(tenancy.tenants)
      ? tenancy.tenants[0]
      : tenancy.tenants
    : null;

  const { data: runs } = await supabase
    .from("agent_runs")
    .select("id, payload, created_at")
    .eq("user_id", userId)
    .eq("agent_type", "maintenance")
    .order("created_at", { ascending: false })
    .limit(40);

  const match = runs?.find(
    (r) => (r.payload as { maintenanceRequestId?: string })?.maintenanceRequestId === requestId,
  );

  const payload = match?.payload as
    | {
        triage?: { responseTime?: string; recommendedAction?: string };
      }
    | undefined;

  let emailLogs: MaintenanceEmailLogRow[] = [];
  if (match?.id) {
    const { data: logs } = await supabase
      .from("email_logs")
      .select("id, subject, status, to_email, to_name, sent_at, created_at")
      .eq("user_id", userId)
      .eq("agent_run_id", match.id)
      .eq("agent_type", "maintenance")
      .order("created_at", { ascending: true });
    emailLogs = (logs ?? []) as MaintenanceEmailLogRow[];
  }

  const desc = row.description as string | null;

  return {
    id: row.id as string,
    tenancyId: (row.tenancy_id as string | null) ?? null,
    propertyId: tenancy?.property_id ?? null,
    propertyAddress: normalizePropertyAddressLabel(property.address ?? "") || null,
    tenantId: tenancy?.tenant_id ?? null,
    tenantFullName: tenant?.full_name ?? null,
    tenantEmail: tenant?.email ?? null,
    description: desc,
    priority: row.priority ?? null,
    status: row.status ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    contractorName: (row.contractor_name as string | null) ?? null,
    contractorEmail: (row.contractor_email as string | null) ?? null,
    aiTriageCategory: row.ai_triage_category ?? null,
    aiTriageSummary: row.ai_triage_summary ?? null,
    tenantAcknowledgedAt: row.tenant_acknowledged_at ?? null,
    landlordNotifiedAt: row.landlord_notified_at ?? null,
    triageFromRun: payload?.triage
      ? {
          responseTime: payload.triage.responseTime,
          recommendedAction: payload.triage.recommendedAction,
        }
      : null,
    maintenanceAgentRunId: match?.id ?? null,
    emailLogs,
  };
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

  const { data: tenancyRow, error: tenancyError } = await supabase
    .from("tenancies")
    .select("id, properties!inner(user_id)")
    .eq("id", values.tenancyId)
    .maybeSingle();

  if (tenancyError || !tenancyRow?.id) {
    return { ok: false as const, error: "Tenancy not found." };
  }

  const prop = tenancyRow.properties as { user_id?: string } | { user_id?: string }[] | null;
  const property = Array.isArray(prop) ? prop[0] : prop;
  if (!property || property.user_id !== user.id) {
    return { ok: false as const, error: "You do not have access to this tenancy." };
  }

  const description = values.description.trim();

  const { data: inserted, error } = await supabase
    .from("maintenance_requests")
    .insert({
      id: crypto.randomUUID(),
      tenancy_id: values.tenancyId,
      description,
      category: values.priority,
      priority: values.priority,
      status: "open",
      reported_by_tenant: false,
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false as const, error: error?.message ?? "Insert failed" };

  revalidatePath("/dashboard/maintenance");

  void runMaintenanceAgent(inserted.id as string, user.id, undefined, {
    landlordEmailFallback: user.email ?? undefined,
  }).catch((err) => console.error("Maintenance agent failed:", err));

  return { ok: true as const, id: inserted.id as string };
}

export async function resolveMaintenanceRequest(requestId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: row, error: fetchError } = await supabase
    .from("maintenance_requests")
    .select("id,tenancies!inner(properties!inner(user_id))")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError || !row) {
    throw new Error("Maintenance request not found");
  }

  const tenancy = unwrapTenancy(row);
  const propRaw = tenancy?.properties;
  const property = (Array.isArray(propRaw) ? propRaw[0] : propRaw) as { user_id?: string } | null;
  if (!property || property.user_id !== user.id) {
    throw new Error("Not found");
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("maintenance_requests")
    .update({
      status: "resolved",
      resolved_at: now,
      updated_at: now,
    })
    .eq("id", requestId)
    .in("status", ["open", "in_progress"])
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }
  if (!updated) {
    throw new Error("Request is not open or could not be updated");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/maintenance");
  revalidatePath(`/dashboard/maintenance/${requestId}`);
}

/**
 * Records contractor name and email on the request (workspace / bookkeeping only).
 * Does **not** send email. Outbound contractor email is approval-gated under Approvals (assistant dispatch with contractor email).
 */
export async function assignContractor(
  requestId: string,
  data: { contractorName: string; contractorEmail: string },
): Promise<void> {
  const parsed = assignContractorSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid contractor details");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: row, error: fetchError } = await supabase
    .from("maintenance_requests")
    .select("id,status,tenancies!inner(properties!inner(user_id))")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError || !row) {
    throw new Error("Maintenance request not found");
  }

  const tenancy = unwrapTenancy(row);
  const propRaw = tenancy?.properties;
  const property = (Array.isArray(propRaw) ? propRaw[0] : propRaw) as { user_id?: string } | null;
  if (!property || property.user_id !== user.id) {
    throw new Error("Not found");
  }

  const rawStatus = (row as { status?: string | null }).status ?? "open";
  const currentStatus = rawStatus.toLowerCase();
  if (currentStatus === "resolved") {
    throw new Error("Cannot assign a contractor to a resolved request");
  }

  const now = new Date().toISOString();
  const nextStatus = currentStatus === "open" ? "in_progress" : rawStatus;

  const { data: updated, error: updateError } = await supabase
    .from("maintenance_requests")
    .update({
      contractor_name: parsed.data.contractorName.trim(),
      contractor_email: parsed.data.contractorEmail.trim(),
      status: nextStatus,
      updated_at: now,
    })
    .eq("id", requestId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }
  if (!updated) {
    throw new Error("Could not update maintenance request");
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath(`/dashboard/maintenance/${requestId}`);
}

export type AssignContractorFormState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | null;

/** Server action for {@link AssignContractorForm} — returns state for toasts; includes hidden `_requestId`. */
export async function assignContractorFormState(
  _prev: AssignContractorFormState,
  formData: FormData,
): Promise<AssignContractorFormState> {
  const requestId = String(formData.get("_requestId") ?? "").trim();
  if (!requestId) {
    return { ok: false, error: "Missing request reference." };
  }
  try {
    await assignContractor(requestId, {
      contractorName: String(formData.get("contractorName") ?? ""),
      contractorEmail: String(formData.get("contractorEmail") ?? ""),
    });
    return {
      ok: true,
      message:
        "Details saved. No email was sent — contractor emails only go out after you approve a dispatch in Approvals.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save contractor details" };
  }
}
