import type { AgentName, LLMProvider } from "./types"
interface AgentModelConfig {
  provider: LLMProvider
  model: string
}
export const AGENT_MODEL_CONFIG: Record<AgentName, AgentModelConfig> = {
  ceo: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  rentChaser: { provider: "google", model: "gemini-1.5-flash" },
  maintenance: { provider: "anthropic", model: "claude-3-haiku-20240307" },
  contracts: { provider: "openai", model: "gpt-4o" },
  leads: { provider: "google", model: "gemini-1.5-flash" },
  analytics: { provider: "openai", model: "gpt-4o-mini" },
}
