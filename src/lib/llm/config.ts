import type { AgentName, LLMProvider } from "./types"
interface AgentModelConfig {
  provider: LLMProvider
  model: string
}
const anthropicModel = process.env.ANTHROPIC_CEO_MODEL?.trim() || "claude-haiku-4-5"
export const AGENT_MODEL_CONFIG: Record<AgentName, AgentModelConfig> = {
  ceo: { provider: "anthropic", model: anthropicModel },
  rentChaser: { provider: "google", model: "gemini-1.5-flash" },
  maintenance: { provider: "anthropic", model: anthropicModel },
  contracts: { provider: "anthropic", model: anthropicModel },
  leads: { provider: "google", model: "gemini-1.5-flash" },
  analytics: { provider: "anthropic", model: anthropicModel },
}
