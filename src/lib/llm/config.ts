import type { AgentName, LLMProvider } from "./types"
interface AgentModelConfig {
  provider: LLMProvider
  model: string
}
export const DEEPSEEK_CONFIG = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  reasoningModel: process.env.DEEPSEEK_REASONING_MODEL || "deepseek-v4-pro",
}

const defaultProvider = (process.env.LLM_PROVIDER?.trim() as LLMProvider) || "deepseek"
const anthropicModel = process.env.ANTHROPIC_CEO_MODEL?.trim() || "claude-haiku-4-5"

export const AGENT_MODEL_CONFIG: Record<AgentName, AgentModelConfig> = {
  ceo: { provider: defaultProvider, model: anthropicModel },
  rentChaser: { provider: defaultProvider, model: "gemini-1.5-flash" },
  maintenance: { provider: defaultProvider, model: anthropicModel },
  contracts: { provider: defaultProvider, model: anthropicModel },
  leads: { provider: defaultProvider, model: "gemini-1.5-flash" },
  analytics: { provider: defaultProvider, model: anthropicModel },
}
