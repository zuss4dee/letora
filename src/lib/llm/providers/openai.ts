import OpenAI from "openai"
import type { LLMMessage, LLMResponse, AgentName } from "../types"
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
export async function runOpenAI(
  model: string,
  messages: LLMMessage[],
  agentName: AgentName,
  temperature = 0.4,
  maxTokens = 1024
): Promise<LLMResponse> {
  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  })
  const text = response.choices?.[0]?.message?.content ?? ""
  return {
    text,
    agentName,
    provider: "openai",
    model,
  }
}
