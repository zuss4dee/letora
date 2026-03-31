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
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data as SafetyAlertRow[];
}
