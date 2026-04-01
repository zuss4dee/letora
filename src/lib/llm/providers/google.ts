import { GoogleGenerativeAI } from "@google/generative-ai"
import type { LLMMessage, LLMResponse, AgentName } from "../types"

function googleApiKey(): string {
  return (
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    ""
  )
}

export async function runGoogle(
  model: string,
  messages: LLMMessage[],
  agentName: AgentName,
  temperature = 0.4,
  maxTokens = 1024
): Promise<LLMResponse> {
  const key = googleApiKey()
  if (!key) {
    throw new Error(
      "Missing GOOGLE_AI_API_KEY (set in .env — same variable used elsewhere for Gemini)",
    )
  }

  const genModel = new GoogleGenerativeAI(key).getGenerativeModel({
    model,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  })

  const systemMessage = messages.find((m) => m.role === "system")?.content ?? ""
  const conversation = messages.filter((m) => m.role !== "system")
  const history = conversation.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))
  const lastMessage = conversation[conversation.length - 1]?.content ?? ""

  const chat = genModel.startChat({ systemInstruction: systemMessage, history })
  const result = await chat.sendMessage(lastMessage)

  return {
    text: result.response.text(),
    agentName,
    provider: "google",
    model,
  }
}
