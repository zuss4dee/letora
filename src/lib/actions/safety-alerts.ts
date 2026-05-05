"use server";

import { createClient } from "@/lib/supabase/server";

export type SafetyAlertRow = {
  id: string;
  created_at: string | null;
  payload: {
    type?: string;
    maintenanceRequestId?: string;
    propertyAddress?: string;
    issueSummary?: string;
    triageCategory?: string;
    createdAt?: string;
  } | null;
};

export async function getSafetyAlertsLast7Days(userId: string): Promise<SafetyAlertRow[]> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data, error } = await supabase
    .from("agent_runs")
    .select("id, payload, created_at")
    .eq("user_id", userId)
    .eq("agent_type", "safety_alert")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !data) return [];

  const rows = data as SafetyAlertRow[];

  const maintenanceIds = [
    ...new Set(
      rows
        .map((r) => r.payload?.maintenanceRequestId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  if (maintenanceIds.length === 0) {
    return rows;
  }

  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("id, status")
    .in("id", maintenanceIds);

  const resolvedIds = new Set(
    (requests ?? [])
      .filter((row) => (String(row.status ?? "").toLowerCase() === "resolved"))
      .map((row) => row.id as string),
  );

  return rows.filter((r) => {
    const mid = r.payload?.maintenanceRequestId;
    if (!mid) return true;
    return !resolvedIds.has(mid);
  });
}

/** Sidebar red dot on Maintenance when any active (non-resolved) safety alert exists. */
export async function getMaintenanceSafetySidebarAttention(userId: string): Promise<boolean> {
  const rows = await getSafetyAlertsLast7Days(userId);
  return rows.length > 0;
}
