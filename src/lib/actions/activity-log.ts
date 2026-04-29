"use server";

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

  const { error } = await supabase.from("agent_activity").insert({
    user_id: targetUserId,
    tool_name: input.eventType, // Using tool_name as eventType for backward compatibility
    source: input.source || "assistant",
    args: input.args || {},
    result: input.result || {},
    success: input.success ?? true,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[logActivity] Failed to insert activity:", error.message);
  }
}
