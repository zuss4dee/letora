import OpenAI from "openai";
import { DEEPSEEK_CONFIG } from "../config";
import type { LLMRequestOptions, LLMResponse } from "../types";

const client = new OpenAI({
  apiKey: DEEPSEEK_CONFIG.apiKey,
  baseURL: DEEPSEEK_CONFIG.baseURL,
});

/**
 * Executes a completion request using DeepSeek's API.
 * Uses the OpenAI Node SDK for compatibility.
 */
export async function runDeepSeek(options: LLMRequestOptions): Promise<LLMResponse> {
  const { agentName, messages, temperature = 0.2, maxTokens = 1024 } = options;

  // Choose model based on agent name: reasoning model for CEO/Contracts, otherwise standard model
  const model = (agentName === "ceo" || agentName === "contracts")
    ? DEEPSEEK_CONFIG.reasoningModel
    : DEEPSEEK_CONFIG.model;

  // Lightweight server-side logging
  console.log(`[DeepSeek] Request: agent=${agentName}, model=${model}, provider=deepseek`);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: messages.map(msg => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      })),
      temperature,
      max_tokens: maxTokens,
    });

    const text = response.choices?.[0]?.message?.content ?? "";

    return {
      text,
      agentName,
      provider: "deepseek",
      model,
    };
  } catch (error) {
    console.error("[DeepSeek] API Error:", error);
    throw new Error(`DeepSeek API call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
