import { AGENT_MODEL_CONFIG } from "./config"
import { runOpenAI } from "./providers/openai"
import { runAnthropic } from "./providers/anthropic"
import { runGoogle } from "./providers/google"
import type { LLMRequestOptions, LLMResponse } from "./types"

export async function runLLM(options: LLMRequestOptions): Promise<LLMResponse> {
  const { agentName, messages, temperature, maxTokens } = options
  const { provider, model } = AGENT_MODEL_CONFIG[agentName]

  switch (provider) {
    case "openai":
      return runOpenAI(model, messages, agentName, temperature, maxTokens)
    case "anthropic":
      return runAnthropic(model, messages, agentName, temperature, maxTokens)
    case "google":
      return runGoogle(model, messages, agentName, temperature, maxTokens)
    default:
      throw new Error(`Unknown LLM provider: ${provider}`)
  }
}
