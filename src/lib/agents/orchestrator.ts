import type { AgentId } from "@/lib/agents/registry";

export type RoutableAgent = AgentId | "lead_qualifier" | "contract_drafter" | "unknown";

/**
 * Lightweight intent routing (post-v1 agents can be registered here).
 * Uses keyword heuristics — replace with an LLM classifier when needed.
 */
export function routeUserIntent(text: string): { agent: RoutableAgent; confidence: number } {
  const t = text.toLowerCase();
  if (/\b(qualify|qualification|lead score|lead)\b/.test(t)) {
    return { agent: "lead_qualifier", confidence: 0.55 };
  }
  if (/\b(contract|tenancy agreement|ast|draft agreement)\b/.test(t)) {
    return { agent: "contract_drafter", confidence: 0.55 };
  }
  if (/\b(rent|chase|overdue|arrears|payment reminder|outstanding rent)\b/.test(t)) {
    return { agent: "rent_chaser", confidence: 0.85 };
  }
  return { agent: "unknown", confidence: 0 };
}
