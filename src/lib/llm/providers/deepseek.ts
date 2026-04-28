import OpenAI from "openai";
import { DEEPSEEK_CONFIG } from "../config";
import type { AgentName, LLMMessage, LLMResponse } from "../types";

const client = new OpenAI({
  apiKey: DEEPSEEK_CONFIG.apiKey,
  baseURL: DEEPSEEK_CONFIG.baseURL,
});

export interface DeepSeekRequestOptions {
  agentName: AgentName;
  messages: LLMMessage[];
  system?: string;
  tools?: any[];
  tool_choice?: any;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Executes a completion request using DeepSeek's API.
 * Uses the OpenAI Node SDK for compatibility.
 */
export async function runDeepSeek(options: DeepSeekRequestOptions): Promise<LLMResponse & { rawResponse?: any }> {
  const { agentName, messages, system, tools, tool_choice, temperature = 0.2, maxTokens = 1024 } = options;

  // Choose model based on agent name: reasoning model for CEO/Contracts, otherwise standard model
  const model = (agentName === "ceo" || agentName === "contracts")
    ? DEEPSEEK_CONFIG.reasoningModel
    : DEEPSEEK_CONFIG.model;

  // Lightweight server-side logging
  console.log(`[DeepSeek] Request: agent=${agentName}, model=${model}, provider=deepseek`);

  const openAiMessages: any[] = [];
  if (system) {
    openAiMessages.push({ role: "system", content: system });
  }
  
  // Combine with existing messages
  messages.forEach(msg => {
    openAiMessages.push({ ...msg });
  });

  // Debug logging for tool calls (redacted)
  if (openAiMessages.some(m => m.tool_calls || m.role === "tool")) {
    console.log("[DeepSeek] Outbound tool-related messages:", JSON.stringify(openAiMessages.map(m => ({
      role: m.role,
      has_content: !!m.content,
      tool_calls_count: m.tool_calls?.length,
      tool_call_id: m.tool_call_id
    })), null, 2));
  }

  try {
    const response = await client.chat.completions.create({
      model,
      messages: openAiMessages,
      tools: tools?.map(t => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        }
      })),
      tool_choice: tool_choice === "any" ? "required" : tool_choice,
      temperature,
      max_tokens: maxTokens,
    });

    const choice = response.choices?.[0];
    const text = choice?.message?.content ?? "";

    return {
      text,
      agentName,
      provider: "deepseek",
      model,
      rawResponse: response,
    };
  } catch (error) {
    console.error("[DeepSeek] API Error:", error);
    throw new Error(`DeepSeek API call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
