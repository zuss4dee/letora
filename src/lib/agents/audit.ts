import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentStepType = "observe" | "think" | "act" | "complete";

/** When an agent finishes its run (final step), refresh dashboard widgets that read `agent_runs`. */
export function revalidateAgentActivityViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agents");
}

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

  if (args.stepType === "complete" || args.toolName === "complete") {
    revalidateAgentActivityViews();
  }
}
