import { AGENT_MODEL_CONFIG } from "./config"
import { runAnthropic } from "./providers/anthropic"
import { runGoogle } from "./providers/google"
import { runDeepSeek } from "./providers/deepseek"
import { runOpenAI } from "./providers/openai"
import type { LLMRequestOptions, LLMResponse } from "./types"

export async function runLLM(options: LLMRequestOptions): Promise<LLMResponse> {
  const { agentName, messages, temperature, maxTokens } = options
  const { provider, model } = AGENT_MODEL_CONFIG[agentName]

  switch (provider) {
    case "deepseek":
      return runDeepSeek(options)
    case "anthropic":
      return runAnthropic(model, messages, agentName, temperature, maxTokens)
    case "google":
      return runGoogle(model, messages, agentName, temperature, maxTokens)
    case "openai":
      return runOpenAI(model, messages, agentName, temperature, maxTokens)
    default:
      return runAnthropic(model, messages, agentName, temperature, maxTokens)
  }
}
