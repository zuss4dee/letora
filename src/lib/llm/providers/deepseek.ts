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

  // Choose model: reasoning model for contracts, strictly non-reasoning for CEO chat
  let model = (agentName === "contracts")
    ? DEEPSEEK_CONFIG.reasoningModel
    : DEEPSEEK_CONFIG.model;

  // Stability fix: If the configured flash model is acting like a reasoning model (like R1),
  // we override to the standard 'deepseek-chat' (V3) for the CEO conversational loop.
  if (agentName === "ceo" && model === "deepseek-v4-flash") {
    model = "deepseek-chat";
  }

  // Mandatory log for production confirmation
  const isReasoning = model === DEEPSEEK_CONFIG.reasoningModel;
  console.log(`[DeepSeek] Call: model=${model}, is_reasoning=${isReasoning} (agent=${agentName})`);

  const openAiMessages: any[] = [];
  if (system) {
    openAiMessages.push({ role: "system", content: system });
  }
  
  // Combine with existing messages - strip any reasoning_content to stay in chat mode
  messages.forEach(msg => {
    const { reasoning_content, ...rest } = msg as any;
    openAiMessages.push(rest);
  });

  // Debug logging for tool calls (redacted)
  if (openAiMessages.some(m => m.tool_calls || m.role === "tool")) {
    console.log("[DeepSeek] Outbound tool-related messages:", JSON.stringify(openAiMessages.map(m => ({
      role: m.role,
      has_tool_calls: !!m.tool_calls,
      tool_call_id: m.tool_call_id
    })), null, 2));
  }

  try {
    // Map Anthropic-style tool_choice to OpenAI-compatible values
    let mappedToolChoice: any = undefined;
    if (tool_choice) {
      if (typeof tool_choice === "string") {
        mappedToolChoice = tool_choice === "any" ? "required" : tool_choice;
      } else if (typeof tool_choice === "object") {
        if (tool_choice.type === "any") mappedToolChoice = "required";
        else if (tool_choice.type === "auto") mappedToolChoice = "auto";
        else if (tool_choice.type === "tool") {
          mappedToolChoice = { type: "function", function: { name: tool_choice.name } };
        } else {
          mappedToolChoice = tool_choice;
        }
      }
    }

    if (mappedToolChoice) {
      console.log(`[DeepSeek] tool_choice mapped to: ${JSON.stringify(mappedToolChoice)}`);
    }

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
      tool_choice: mappedToolChoice,
      temperature,
      max_tokens: maxTokens,
    });

    const choice = response.choices?.[0];
    const message = choice?.message;
    const text = message?.content ?? "";

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
