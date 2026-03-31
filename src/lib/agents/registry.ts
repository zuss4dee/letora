export type AgentId = "rent_chaser" | "tenant_onboarding";

export type AgentRegistryEntry = {
  id: AgentId;
  /** Relative to `agents/` */
  agentsMd: string;
  skillPaths: string[];
};

export const AGENT_REGISTRY: Record<AgentId, AgentRegistryEntry> = {
  rent_chaser: {
    id: "rent_chaser",
    agentsMd: "rent_chaser/agents.md",
    skillPaths: [
      "rent_chaser/skills/draft_chase_email.md",
      "rent_chaser/skills/escalate_to_legal.md",
      "skills/email_uk_tone.md",
    ],
  },
  tenant_onboarding: {
    id: "tenant_onboarding",
    agentsMd: "tenant_onboarding/agents.md",
    skillPaths: [
      "tenant_onboarding/skills/send_welcome_email.md",
      "tenant_onboarding/skills/reference_check_checklist.md",
      "tenant_onboarding/skills/move_in_instructions.md",
    ],
  },
};

export function getAgentEntry(id: AgentId): AgentRegistryEntry {
  return AGENT_REGISTRY[id];
}
