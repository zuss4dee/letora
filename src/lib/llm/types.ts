export type LLMProvider = "anthropic" | "google" | "openai" | "deepseek"

export type AgentName =
  | "ceo"
  | "rentChaser"
  | "maintenance"
  | "contracts"
  | "leads"
  | "analytics"

export interface LLMMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LLMResponse {
  text: string
  agentName: AgentName
  provider: LLMProvider
  model: string
}

export interface LLMRequestOptions {
  agentName: AgentName
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
}
