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
  // Haiku for batch JSON; use a widely available model ID (Haiku 4.5 may require newer API access).
  leads: { provider: "anthropic", model: "claude-3-5-haiku-20241022" },
  analytics: { provider: "openai", model: "gpt-4o-mini" },
}
