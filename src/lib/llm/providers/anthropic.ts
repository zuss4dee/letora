import Anthropic from "@anthropic-ai/sdk"
import type { LLMMessage, LLMResponse, AgentName } from "../types"
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
export async function runAnthropic(
  model: string,
  messages: LLMMessage[],
  agentName: AgentName,
  temperature = 0.4,
  maxTokens = 1024
): Promise<LLMResponse> {
  const systemMessage = messages.find((m) => m.role === "system")?.content ?? ""
  const conversation = messages.filter((m) => m.role !== "system")
  const effectiveModel = model || process.env.ANTHROPIC_CEO_MODEL?.trim() || "claude-haiku-4-5"
  const response = await client.messages.create({
    model: effectiveModel,
    max_tokens: maxTokens,
    temperature,
    system: systemMessage,
    messages: conversation.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  })
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
  return {
    text,
    agentName,
    provider: "anthropic",
    model,
  }
}
