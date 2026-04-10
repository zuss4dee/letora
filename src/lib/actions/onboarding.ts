"use server";

import { revalidatePath } from "next/cache";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { createClient } from "@/lib/supabase/server";
import { userFacingError } from "@/lib/user-facing-errors";

export type OnboardingTaskRow = {
  id: string;
  task_name: string;
  task_type: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  email_log_id: string | null;
  email_sent_at: string | null;
  email_log_status: string | null;
};

export type TenancyOnboardingDetail = {
  id: string;
  propertyAddress: string | null;
  tenantName: string | null;
  onboarding_status: string;
  start_date: string | null;
  referencing_token: string | null;
  referencing_agency_email_override: string | null;
  referencing_last_outbound_at: string | null;
  referencing_last_inbound_at: string | null;
  tasks: OnboardingTaskRow[];
};

export async function getTenancyOnboardingDetail(tenancyId: string): Promise<TenancyOnboardingDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row, error } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      start_date,
      onboarding_status,
      referencing_token,
      referencing_agency_email_override,
      referencing_last_outbound_at,
      referencing_last_inbound_at,
      properties!inner ( address, user_id ),
      tenants ( full_name )
    `,
    )
    .eq("id", tenancyId)
    .maybeSingle();

  if (error || !row) return null;

  const property = row.properties as unknown as { address: string | null; user_id: string };
  if (property.user_id !== user.id) return null;

  const tenantRaw = row.tenants as unknown as { full_name: string | null } | null | { full_name: string | null }[];
  const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
  const onboardingStatus = (row as { onboarding_status?: string }).onboarding_status ?? "not_started";

  const { data: taskRows } = await supabase
    .from("onboarding_tasks")
    .select("id, task_name, task_type, status, due_date, completed_at, email_log_id")
    .eq("tenancy_id", tenancyId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const tasks: OnboardingTaskRow[] = [];
  for (const t of taskRows ?? []) {
    let email_sent_at: string | null = null;
    let email_log_status: string | null = null;
    if (t.email_log_id) {
      const { data: log } = await supabase
        .from("email_logs")
        .select("sent_at, status")
        .eq("id", t.email_log_id)
        .eq("user_id", user.id)
        .maybeSingle();
      email_sent_at = log?.sent_at ?? null;
      email_log_status = log?.status ?? null;
    }
    tasks.push({
      id: t.id,
      task_name: t.task_name,
      task_type: t.task_type,
      status: t.status,
      due_date: t.due_date,
      completed_at: t.completed_at,
      email_log_id: t.email_log_id,
      email_sent_at,
      email_log_status,
    });
  }

  const r = row as {
    start_date?: string | null;
    referencing_token?: string | null;
    referencing_agency_email_override?: string | null;
    referencing_last_outbound_at?: string | null;
    referencing_last_inbound_at?: string | null;
  };

  return {
    id: row.id,
    propertyAddress: normalizePropertyAddressLabel(property.address?.trim() ?? "") || null,
    tenantName: tenant?.full_name ?? null,
    onboarding_status: onboardingStatus,
    start_date: r.start_date ?? null,
    referencing_token: r.referencing_token ?? null,
    referencing_agency_email_override: r.referencing_agency_email_override ?? null,
    referencing_last_outbound_at: r.referencing_last_outbound_at ?? null,
    referencing_last_inbound_at: r.referencing_last_inbound_at ?? null,
    tasks,
  };
}

/**
 * Marks any **pending** onboarding task complete (landlord override). Includes email-type
 * tasks: does not send email — use when work was done outside Letora.
 */
export async function completeManualOnboardingTask(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: task, error: fetchError } = await supabase
    .from("onboarding_tasks")
    .select("id, tenancy_id, task_type, status")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !task) return { ok: false as const, error: "Task not found" };
  if (task.status === "complete") return { ok: true as const };
  if (task.status !== "pending") {
    return { ok: false as const, error: "Only pending tasks can be marked complete here" };
  }

  const { error: updateError } = await supabase
    .from("onboarding_tasks")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (updateError)
    return {
      ok: false as const,
      error: userFacingError(updateError.message, "We couldn't update onboarding. Please try again."),
    };

  revalidatePath(`/dashboard/tenancies/${task.tenancy_id}`);
  revalidatePath("/dashboard/tenancies");
  return { ok: true as const };
}

/** Reverts a **complete** task to **pending** (e.g. user unchecked the box). */
export async function revertOnboardingTaskToPending(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: task, error: fetchError } = await supabase
    .from("onboarding_tasks")
    .select("id, tenancy_id, status")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !task) return { ok: false as const, error: "Task not found" };
  if (task.status !== "complete") {
    return { ok: false as const, error: "Only completed tasks can be reverted here" };
  }

  const { error: updateError } = await supabase
    .from("onboarding_tasks")
    .update({
      status: "pending",
      completed_at: null,
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (updateError)
    return {
      ok: false as const,
      error: userFacingError(updateError.message, "We couldn't update onboarding. Please try again."),
    };

  revalidatePath(`/dashboard/tenancies/${task.tenancy_id}`);
  revalidatePath("/dashboard/tenancies");
  return { ok: true as const };
}
