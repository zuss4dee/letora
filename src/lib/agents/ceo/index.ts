import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  Message,
  MessageParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages";

import { CEO_SYSTEM_PROMPT } from "./system-prompt";
import { CEO_TOOLS } from "./tools";
import type { CEOToolName } from "./tools";
import { isCEOToolName } from "./tools";
import { executeCEOTool } from "./executor";
import {
  buildConfirmationMessage,
  classifyCEOIntent,
  getLatestUserContent,
  isAffirmativeConfirmation,
  pendingActionFromToolUseBlocks,
  toolsRequireUserConfirmation,
} from "./safety";
import type { PendingCEOAction } from "./safety";
import {
  DEFAULT_MAX_CEO_CONVERSATION_MESSAGES,
  trimConversationMessages,
} from "./trim-conversation";
import { wrapToolResultForModel } from "./tool-result-presentation";
import {
  formatRouterHintForSystem,
  routeCEOIntent,
  type CEOIntentRoute,
} from "./intent-router";
import {
  inferOnboardingForFromConversation,
  mergeEnrichedOnboardingInput,
} from "./enrich-onboarding-input";
import {
  buildCeoFailureThrottleKey,
  shouldInsertSystemAlertRow,
  shouldSendAdminAlertEmail,
} from "@/lib/alerts/alert-throttle";
import { createSystemAlert, notifyAdminByEmail } from "@/lib/alerts/admin-alerts";

export type { PendingCEOAction } from "./safety";
export { parsePendingCEOActionFromJson } from "./safety";
export type { CEOIntentRoute, CEOPropertyIntentId } from "./intent-router";
export { formatRouterHintForSystem, routeCEOIntent } from "./intent-router";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Use API model IDs from https://platform.claude.com/docs/en/about-claude/models/overview
// (Console “Haiku Active” maps to e.g. claude-haiku-4-5 — not legacy claude-3-* snapshot IDs.)
const ANTHROPIC_CEO_MODEL = process.env.ANTHROPIC_CEO_MODEL?.trim() || "claude-haiku-4-5";
const geminiApiKey = process.env.GOOGLE_AI_API_KEY?.trim();
const geminiClient = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function contentPartToText(part: unknown): string {
  if (typeof part === "string") return part;
  if (typeof part !== "object" || part === null) return String(part ?? "");
  const p = part as Record<string, unknown>;
  if (p.type === "text" && typeof p.text === "string") return p.text;
  if (p.type === "tool_use") {
    const name = typeof p.name === "string" ? p.name : "unknown_tool";
    return `[Tool requested: ${name}]`;
  }
  if (p.type === "tool_result") {
    const c = p.content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) return c.map(contentPartToText).join("\n");
    if (c && typeof c === "object") return JSON.stringify(c);
    return "";
  }
  if (typeof p.content === "string") return p.content;
  return JSON.stringify(p);
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(contentPartToText).join("\n");
  return contentPartToText(content);
}

function convertAnthropicConversationForGemini(messages: MessageParam[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: messageContentToText(m.content) }],
  }));
}

async function runAdminFailureAlert(params: {
  stage: "anthropic_loop" | "anthropic_summary";
  error: unknown;
  userId: string;
}) {
  const message = toErrorMessage(params.error);
  const { emailKey, dbKey } = buildCeoFailureThrottleKey(params.stage, message);
  const sendEmail = shouldSendAdminAlertEmail(emailKey);
  const insertDb = shouldInsertSystemAlertRow(dbKey);

  console.error("[ceo] anthropic failure", {
    stage: params.stage,
    model: ANTHROPIC_CEO_MODEL,
    userId: params.userId,
    throttle: { sendEmail, insertDb, emailKey, dbKey },
    error: message,
  });
  const tasks: Promise<unknown>[] = [];
  if (insertDb) {
    tasks.push(
      createSystemAlert({
        alertType: "ceo_primary_model_failure",
        message: `Anthropic failed during ${params.stage}; falling back to Gemini.`,
        errorDetails: {
          stage: params.stage,
          userId: params.userId,
          errorMessage: message,
        },
      }),
    );
  }
  if (sendEmail) {
    tasks.push(
      notifyAdminByEmail({
        subject: "Letora Alert: CEO Anthropic failure, Gemini fallback",
        body: [
          "Anthropic failed in the CEO agent and fallback was triggered.",
          `Stage: ${params.stage}`,
          `User ID: ${params.userId}`,
          "",
          "Raw error:",
          message,
        ].join("\n"),
      }),
    );
  }
  if (tasks.length === 0) return;
  await Promise.allSettled(tasks);
}

async function runGeminiFallback(params: {
  systemPrompt: string;
  conversation: MessageParam[];
}): Promise<string> {
  if (!geminiClient) {
    throw new Error("Missing GOOGLE_AI_API_KEY for fallback");
  }
  const model = geminiClient.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
  });
  const converted = convertAnthropicConversationForGemini(params.conversation);
  const history = converted.slice(0, -1);
  const latest = converted[converted.length - 1];
  const lastText = latest?.parts?.[0]?.text ?? "";
  const chat = model.startChat({
    systemInstruction: {
      role: "system",
      parts: [{ text: params.systemPrompt }],
    },
    history,
  });
  const res = await chat.sendMessage(lastText);
  return res.response.text().trim() || "I'm sorry, I couldn't process that request.";
}

export interface CEOMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CEOAgentOptions {
  userId: string;
  /** Session-scoped client (same as dashboard) so RLS matches the signed-in user. */
  supabase: SupabaseClient;
  messages: CEOMessage[];
  confirmedExecution?: boolean;
  pendingAction?: PendingCEOAction | null;
}

export type CEOChatResult =
  | { outcome: "complete"; reply: string }
  | { outcome: "needs_clarification"; message: string }
  | { outcome: "needs_confirmation"; message: string; pendingAction: PendingCEOAction };

function extractFinalText(message: Message): string {
  const parts: string[] = [];
  for (const b of message.content) {
    if (b.type === "text") parts.push(b.text);
  }
  return parts.join("\n").trim() || "I'm sorry, I couldn't process that request.";
}

/** When routing misses or the model ends_turn without tools, we still inject real lead rows. */
function shouldInjectLeadsAuthoritativeSummary(route: CEOIntentRoute, latestUser: string): boolean {
  const u = latestUser.trim();
  if (/\bqualify\b/i.test(u) && /\bleads?\b/i.test(u)) {
    return false;
  }
  if (route.primaryIntent === "leads" || route.recommendedTools.includes("get_leads_summary")) {
    return true;
  }
  const t = latestUser.trim();
  return (
    /\b(show\s+me\s+)?(my\s+)?(the\s+)?leads?\b/i.test(t) ||
    /\b(leads?\s+pipeline|lead\s+pipeline)\b/i.test(t) ||
    /\b(prospects?|enquir(y|ies))\b/i.test(t) ||
    /\b(my\s+)?(sales\s+)?pipeline\b/i.test(t)
  );
}

type LeadsSummaryPayload = {
  total: number;
  new: number;
  pending_qualification: number;
  qualified: number;
  disqualified: number;
  recent?: Array<{
    id?: string;
    full_name?: string;
    email?: string | null;
    status?: string | null;
    qualified_status?: string | null;
    created_at?: string | null;
  }>;
  error?: string;
};

function parseLeadsSummaryPayload(raw: string): LeadsSummaryPayload | null {
  try {
    const j = JSON.parse(raw) as unknown;
    if (typeof j !== "object" || j === null) return null;
    const o = j as Record<string, unknown>;
    if (typeof o.total !== "number") return null;
    return o as LeadsSummaryPayload;
  } catch {
    return null;
  }
}

function formatLeadPipelineMarkdown(p: LeadsSummaryPayload): string {
  const lines = [
    "**Lead pipeline**",
    "",
    `- **Total leads:** ${p.total}`,
    `- **New leads:** ${p.new}`,
    `- **Pending qualification:** ${p.pending_qualification}`,
    `- **Qualified:** ${p.qualified}`,
    `- **Disqualified:** ${p.disqualified}`,
  ];
  if (p.recent && p.recent.length > 0) {
    lines.push("", "**Recent:**");
    for (const r of p.recent) {
      const name = r.full_name ?? "Unknown";
      const status = r.status ?? "—";
      const q = r.qualified_status ?? "—";
      lines.push(`- **${name}** — status: ${status}; qualification: ${q}`);
    }
  }
  return lines.join("\n");
}

/** The model often ignores injected JSON and returns end_turn with “0 leads”; override with DB truth. */
function correctLeadReplyAgainstAuthoritative(reply: string, authoritativeRaw: string | null): string {
  if (!authoritativeRaw) return reply;
  const payload = parseLeadsSummaryPayload(authoritativeRaw);
  if (!payload || payload.error) return reply;
  if (payload.total <= 0) return reply;

  const t = reply.toLowerCase();
  const claimsEmpty =
    /\b(no leads|zero leads|don't have any leads|do not have any leads|lead pipeline is empty|nothing in (your )?pipeline)\b/.test(
      t,
    ) ||
    /\*\*total leads:\*\*\s*0\b/i.test(reply) ||
    /\btotal leads:\s*0\b/i.test(t);

  if (claimsEmpty) {
    return formatLeadPipelineMarkdown(payload);
  }
  return reply;
}

export async function runCEOChat(options: CEOAgentOptions): Promise<CEOChatResult> {
  const { userId, supabase, messages, confirmedExecution, pendingAction } = options;
  const contextMessages = trimConversationMessages(
    messages,
    DEFAULT_MAX_CEO_CONVERSATION_MESSAGES,
  );

  if (confirmedExecution && pendingAction && pendingAction.toolCalls.length > 0) {
    const latest = getLatestUserContent(contextMessages);
    if (!isAffirmativeConfirmation(latest)) {
      return {
        outcome: "complete",
        reply:
          "Reply **yes** to run the pending actions, or ask something else to drop this request.",
      };
    }

    const inferredOnboardingName = inferOnboardingForFromConversation(contextMessages);

    const resultBlocks: string[] = [];
    for (const call of pendingAction.toolCalls) {
      const input =
        call.name === "start_tenant_onboarding"
          ? mergeEnrichedOnboardingInput(call.input, inferredOnboardingName)
          : call.input;
      const raw = await executeCEOTool(call.name, input, userId, supabase);
      resultBlocks.push(wrapToolResultForModel(call.name, raw));
    }

    const summarySystemPrompt =
      CEO_SYSTEM_PROMPT +
      "\n\nThe landlord already confirmed the pending actions. Tool runs are complete. Summarize outcomes in natural language. Do not ask for confirmation again." +
      "\n\n**Mandatory for tool JSON:** If any result has `success`: false or an `error` string, say exactly what failed using the `message` or `error` field (e.g. missing email, onboarding already started). **Do not** claim the system rejected a plain-name input, or cite UUID/form validation errors, unless those exact words appear in the JSON.";
    const summaryMessages: MessageParam[] = [
      {
        role: "user",
        content: "Confirmed action — tool results (internal):\n\n" + resultBlocks.join("\n---\n"),
      },
    ];
    try {
      const summaryResp = await anthropic.messages.create({
        model: ANTHROPIC_CEO_MODEL,
        max_tokens: 2048,
        system: summarySystemPrompt,
        messages: summaryMessages,
      });
      return { outcome: "complete", reply: extractFinalText(summaryResp) };
    } catch (anthropicError) {
      await runAdminFailureAlert({
        stage: "anthropic_summary",
        error: anthropicError,
        userId,
      });
      try {
        const reply = await runGeminiFallback({
          systemPrompt: summarySystemPrompt,
          conversation: summaryMessages,
        });
        return { outcome: "complete", reply };
      } catch (geminiError) {
        console.error("[ceo] gemini fallback failure", {
          stage: "anthropic_summary",
          userId,
          error: toErrorMessage(geminiError),
        });
        throw new Error(
          `AI services are temporarily unavailable. Primary and fallback models failed. Anthropic: ${toErrorMessage(
            anthropicError,
          )}; Gemini: ${toErrorMessage(geminiError)}`,
        );
      }
    }
  }

  const latestUser = getLatestUserContent(contextMessages);
  const route = routeCEOIntent(latestUser);

  const routerHint = formatRouterHintForSystem(route);
  const systemPrompt = routerHint ? `${CEO_SYSTEM_PROMPT}\n\n${routerHint}` : CEO_SYSTEM_PROMPT;

  /** Snapshot JSON from get_leads_summary — used to override model text that ignores system injection. */
  let authoritativeLeadsRaw: string | null = null;

  let effectiveSystemPrompt = systemPrompt;
  if (shouldInjectLeadsAuthoritativeSummary(route, latestUser)) {
    const leadsRaw = await executeCEOTool("get_leads_summary", {}, userId, supabase);
    authoritativeLeadsRaw = leadsRaw;
    effectiveSystemPrompt = `${systemPrompt}\n\nAuthoritative lead data from the database (use these exact counts and recent rows; do not invent numbers):\n${leadsRaw}`;
  }

  const intent = classifyCEOIntent(latestUser);
  const conversation: MessageParam[] = contextMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let i = 0; i < 5; i++) {
    let response: Message;
    try {
      response = await anthropic.messages.create({
        model: ANTHROPIC_CEO_MODEL,
        max_tokens: 2048,
        system: effectiveSystemPrompt,
        tools: CEO_TOOLS,
        messages: conversation,
      });
    } catch (anthropicError) {
      await runAdminFailureAlert({
        stage: "anthropic_loop",
        error: anthropicError,
        userId,
      });
      try {
        const reply = await runGeminiFallback({
          systemPrompt: effectiveSystemPrompt,
          conversation,
        });
        return {
          outcome: "complete",
          reply: correctLeadReplyAgainstAuthoritative(reply, authoritativeLeadsRaw),
        };
      } catch (geminiError) {
        console.error("[ceo] gemini fallback failure", {
          stage: "anthropic_loop",
          userId,
          error: toErrorMessage(geminiError),
        });
        throw new Error(
          `AI services are temporarily unavailable. Primary and fallback models failed. Anthropic: ${toErrorMessage(
            anthropicError,
          )}; Gemini: ${toErrorMessage(geminiError)}`,
        );
      }
    }

    if (response.stop_reason === "end_turn") {
      return {
        outcome: "complete",
        reply: correctLeadReplyAgainstAuthoritative(extractFinalText(response), authoritativeLeadsRaw),
      };
    }

    conversation.push({ role: "assistant", content: response.content });
    const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (toolUseBlocks.length === 0) {
      return {
        outcome: "complete",
        reply: correctLeadReplyAgainstAuthoritative(extractFinalText(response), authoritativeLeadsRaw),
      };
    }

    const toolNames: CEOToolName[] = toolUseBlocks.map((b) => {
      if (!isCEOToolName(b.name)) {
        throw new Error(`Unknown CEO tool: ${b.name}`);
      }
      return b.name;
    });

    if (toolsRequireUserConfirmation(intent, toolNames)) {
      const pending = pendingActionFromToolUseBlocks(toolUseBlocks);
      return {
        outcome: "needs_confirmation",
        message: buildConfirmationMessage(pending),
        pendingAction: pending,
      };
    }

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const toolName = block.name as CEOToolName;
        const args = block.input as Record<string, string>;
        const result = await executeCEOTool(toolName, args, userId, supabase);
        if (toolName === "get_leads_summary") {
          authoritativeLeadsRaw = result;
        }
        return {
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: wrapToolResultForModel(toolName, result),
        };
      }),
    );
    conversation.push({ role: "user", content: toolResults });
  }

  return {
    outcome: "complete",
    reply: "I'm having trouble completing this request. Please try again.",
  };
}

export async function runCEOAgent(options: CEOAgentOptions): Promise<string> {
  const result = await runCEOChat(options);
  if (result.outcome === "needs_clarification") return result.message;
  if (result.outcome === "needs_confirmation") return result.message;
  return result.reply;
}
