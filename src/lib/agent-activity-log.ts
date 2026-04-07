import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentActivityOutcome = "success" | "error";

export type LogAgentActivityInput = {
  userId: string;
  agentName: string;
  actionTaken: string;
  inputSummary?: string | null;
  outputSummary?: string | null;
  status?: AgentActivityOutcome;
  requiresApproval?: boolean;
};

/**
 * Writes a structured row to `agent_activity_log` for agent HTTP entrypoints.
 * Does not throw — logging failures are console-only so requests still complete.
 */
export async function logAgentActivity(
  supabase: SupabaseClient,
  input: LogAgentActivityInput,
): Promise<void> {
  const { error } = await supabase.from("agent_activity_log").insert({
    id: crypto.randomUUID(),
    user_id: input.userId,
    agent_name: input.agentName,
    action_taken: input.actionTaken,
    input_summary: input.inputSummary ?? null,
    output_summary: input.outputSummary ?? null,
    status: input.status ?? "success",
    requires_approval: input.requiresApproval ?? false,
  });
  if (error) {
    console.error("[agent_activity_log] insert failed:", error);
  }
}
