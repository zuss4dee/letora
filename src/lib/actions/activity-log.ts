"use server";

import { revalidatePath } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ActivitySource = "assistant" | "landlord" | "system";

export type LogActivityInput = {
  userId?: string;
  eventType: string;
  source?: ActivitySource;
  args?: Record<string, any>;
  result?: Record<string, any>;
  success?: boolean;
};

/**
 * Unified activity logging.
 * Writes to the `agent_activity` table.
 */
export async function logActivity(input: LogActivityInput, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || (await createClient());
  
  let targetUserId = input.userId;
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[logActivity] No user session found for logging");
      return;
    }
    targetUserId = user.id;
  }

  const payload: any = {
    user_id: targetUserId,
    tool_name: input.eventType,
    args: input.args || {},
    result: input.result || {},
    success: input.success ?? true,
    created_at: new Date().toISOString(),
  };

  // Try to insert with source column, fallback if migration hasn't run yet
  const { error } = await supabase.from("agent_activity").insert({
    ...payload,
    source: input.source || "assistant",
  });

  if (error) {
    if (error.code === "42703") { // undefined_column
      console.warn("[logActivity] 'source' column missing, retrying without it");
      const { error: retryError } = await supabase.from("agent_activity").insert(payload);
      if (retryError) {
        console.error("[logActivity] Retry failed:", retryError.message);
      }
    } else {
      console.error("[logActivity] Failed to insert activity:", error.message);
    }
  }

  // Always revalidate activity paths to be safe
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
}
/**
 * Fetches recent activity for a user with robust column fallback.
 */
export async function getRecentActivity(userId: string, limit = 50) {
  const supabase = await createClient();
  
  const primaryResult = await supabase
    .from("agent_activity")
    .select("id, tool_name, args, result, success, created_at, source")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (primaryResult.error && primaryResult.error.code === "42703") {
    // source column missing fallback
    const fallbackResult = await supabase
      .from("agent_activity")
      .select("id, tool_name, args, result, success, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (fallbackResult.data || []).map(row => ({
      ...row,
      source: null as string | null
    }));
  }

  return primaryResult.data || [];
}
