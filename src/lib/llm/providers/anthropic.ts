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
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemMessage,
    messages: conversation.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  })
  const firstBlock = response.content[0]
  const text = firstBlock?.type === "text" ? firstBlock.text : ""
  return {
    text,
    agentName,
    provider: "anthropic",
    model,
  }
}
