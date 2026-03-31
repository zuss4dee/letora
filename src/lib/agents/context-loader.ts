import type { SupabaseClient } from "@supabase/supabase-js";

import { readAgentFile } from "@/lib/agents/paths";
import type { AgentId } from "@/lib/agents/registry";
import { getAgentEntry } from "@/lib/agents/registry";

export type AgentMemoryRow = {
  memory_key: string;
  memory_value: string;
};

/**
 * Load agent markdown + shared philosophy + optional skills + per-user memory rows.
 * Server-only (uses fs + Supabase).
 */
export async function loadAgentContext(
  supabase: SupabaseClient,
  agentId: AgentId,
  userId: string,
  options?: { includeShared?: boolean },
): Promise<string> {
  const includeShared = options?.includeShared ?? true;
  const entry = getAgentEntry(agentId);

  const parts: string[] = [];

  if (includeShared) {
    parts.push("## Shared philosophy\n\n", readAgentFile("_shared/philosophy.md"), "\n\n");
  }

  parts.push("## Agent instructions\n\n", readAgentFile(entry.agentsMd), "\n\n");

  parts.push("## Skills\n\n");
  for (const skillPath of entry.skillPaths) {
    parts.push(`### ${skillPath}\n\n`, readAgentFile(skillPath), "\n\n");
  }

  const { data: memoryRows, error: memoryError } = await supabase
    .from("user_agent_memory")
    .select("memory_key, memory_value")
    .eq("user_id", userId)
    .eq("agent_key", agentId);

  if (memoryError) {
    console.warn("[loadAgentContext] user_agent_memory:", memoryError.message);
  }

  if (memoryRows?.length) {
    parts.push("## User memory\n\n");
    for (const row of memoryRows as AgentMemoryRow[]) {
      parts.push(`- **${row.memory_key}:** ${row.memory_value}\n`);
    }
    parts.push("\n");
  }

  return parts.join("");
}
