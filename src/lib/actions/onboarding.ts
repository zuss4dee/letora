"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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
      properties!inner ( address, city, user_id ),
      tenant_profiles ( full_name )
    `,
    )
    .eq("id", tenancyId)
    .maybeSingle();

  if (error || !row) return null;

  const property = row.properties as unknown as { address: string | null; city: string | null; user_id: string };
  if (property.user_id !== user.id) return null;

  const tenantRaw = row.tenant_profiles as unknown as { full_name: string | null } | null | { full_name: string | null }[];
  const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
  const addressParts = [property.address, property.city].filter(Boolean);
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

  return {
    id: row.id,
    propertyAddress: addressParts.join(", ") || null,
    tenantName: tenant?.full_name ?? null,
    onboarding_status: onboardingStatus,
    start_date: (row as { start_date?: string | null }).start_date ?? null,
    tasks,
  };
}

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
  if (task.task_type !== "manual") return { ok: false as const, error: "Only manual tasks can be marked here" };
  if (task.status === "complete") return { ok: true as const };

  const { error: updateError } = await supabase
    .from("onboarding_tasks")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (updateError) return { ok: false as const, error: updateError.message };

  revalidatePath(`/dashboard/tenancies/${task.tenancy_id}`);
  revalidatePath("/dashboard/tenancies");
  return { ok: true as const };
}
