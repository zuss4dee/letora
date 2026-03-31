import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentStepType = "observe" | "think" | "act" | "complete";

export async function recordAgentRunStep(
  supabase: SupabaseClient,
  args: {
    userId: string;
    agentRunId: string | null;
    stepIndex: number;
    stepType: AgentStepType;
    toolName: string | null;
    detail: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("agent_run_steps").insert({
    user_id: args.userId,
    agent_run_id: args.agentRunId,
    step_index: args.stepIndex,
    step_type: args.stepType,
    tool_name: args.toolName,
    detail: args.detail,
  });
  if (error) {
    console.warn("[recordAgentRunStep]", error.message);
  }
}
