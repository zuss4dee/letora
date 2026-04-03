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
  stripCeoHexUuidsFromText,
  toolsRequireUserConfirmation,
} from "./safety";
import type { PendingCEOAction } from "./safety";
import {
  DEFAULT_MAX_CEO_CONVERSATION_MESSAGES,
  trimConversationMessages,
} from "./trim-conversation";
import { wrapToolResultForModel } from "./tool-result-presentation";
import { mergeCompleteReplySuggestedActions } from "./suggested-actions";
import type { LetoraSuggestedAction } from "./suggested-actions";
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
import { fetchReferencingInboundDigestForCeo } from "@/lib/referencing/inbound-digest";

export type { PendingCEOAction } from "./safety";
export { parsePendingCEOActionFromJson } from "./safety";
export type { LetoraSuggestedAction } from "./suggested-actions";
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
  | { outcome: "complete"; reply: string; suggestedActions?: LetoraSuggestedAction[] }
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

function scrubUuidLike(s: string): string {
  return s.replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, "[ref]");
}

/** Same failure mode as empty lead counts: model end_turn ignores prefetched JSON — replace with DB truth. */
function correctReferencingInboundReply(
  reply: string,
  referencingPrefetchRaw: string | null,
  referencingInboundDigest: string | null,
): string {
  const claimsNoInbound =
    /\b(no\s+response|no\s+reply|not\s+responded|no\s+inbound|still\s+awaiting|haven'?t\s+(heard|received)|waiting\s+for\s+(the\s+)?(agency|referencing)|no\s+agency\s+(reply|response)|no\s+inbound\s+updates?|provided\s+any\s+inbound|no\s+new\s+update|not\s+confirmed\s+completion)\b/i.test(
      reply,
    ) ||
    /\b(awaiting\s+.*\s+agency|referencing\s+incomplete)\b/i.test(reply);

  if (!claimsNoInbound) return reply;

  type InboundRow = { body_preview?: string | null; subject?: string | null; outcome?: string | null; created_at?: string | null };
  let rows: InboundRow[] = [];
  let tenantLabel: string | null = null;

  if (referencingPrefetchRaw) {
    try {
      const parsed = JSON.parse(referencingPrefetchRaw) as {
        ok?: boolean;
        recent_inbound_mail?: InboundRow[];
        tenant_name?: string | null;
      };
      if (parsed.ok === true && Array.isArray(parsed.recent_inbound_mail) && parsed.recent_inbound_mail.length > 0) {
        rows = parsed.recent_inbound_mail;
        tenantLabel =
          typeof parsed.tenant_name === "string" && parsed.tenant_name.trim() ? parsed.tenant_name.trim() : null;
      }
    } catch {
      /* ignore */
    }
  }

  if (rows.length === 0 && referencingInboundDigest) {
    const lineRe = /^-\s+(.+)$/gm;
    let m: RegExpExecArray | null;
    const digestLines: string[] = [];
    while ((m = lineRe.exec(referencingInboundDigest)) !== null) {
      digestLines.push(m[1].trim());
    }
    if (digestLines.length > 0) {
      return [
        "**Referencing — inbound activity on record**",
        "",
        "Letora has logged inbound referencing mail recently. Summary from your account:",
        ...digestLines.map((l) => `- ${scrubUuidLike(l)}`),
        "",
        "Open **Tenancy → Referencing** for full detail.",
      ].join("\n");
    }
  }

  if (rows.length === 0) return reply;

  const label = tenantLabel ?? "this tenancy";
  const bullets = rows.slice(0, 4).map((r) => {
    const when =
      typeof r.created_at === "string" && r.created_at.length >= 16
        ? `${r.created_at.slice(0, 16).replace("T", " ")} UTC`
        : "recent";
    const oc = (r.outcome ?? "—").trim();
    const preview = scrubUuidLike(
      ((r.body_preview ?? r.subject ?? "") as string).trim().slice(0, 320) || "—",
    );
    return `- **${when}** · outcome **${oc}** · ${preview}`;
  });

  return [
    `**Referencing update — ${label}**`,
    "",
    "Letora **has** recorded inbound referencing mail for this tenancy (this is not “no reply” in the system):",
    ...bullets,
    "",
    "Classification may show as **unknown** until wording clearly matches pass/fail keywords. Check **Tenancy → Referencing** for the full thread.",
  ].join("\n");
}

function pickPrepareReferencingRawFromBatch(
  lastToolBatch: readonly { name: CEOToolName; raw: string }[],
): string | null {
  for (let i = lastToolBatch.length - 1; i >= 0; i--) {
    if (lastToolBatch[i]!.name === "prepare_referencing") return lastToolBatch[i]!.raw;
  }
  return null;
}

/** The model often ignores injected JSON and returns end_turn with “0 leads”; override with DB truth. */
function completeWithSuggestedActions(
  reply: string,
  lastToolBatch: readonly { name: CEOToolName; raw: string }[],
  authoritativeLeadsRaw: string | null,
  referencingPrefetchRaw: string | null = null,
  referencingInboundDigest: string | null = null,
): { outcome: "complete"; reply: string; suggestedActions?: LetoraSuggestedAction[] } {
  const corrected = correctLeadReplyAgainstAuthoritative(reply, authoritativeLeadsRaw);
  const prefetchMerged = pickPrepareReferencingRawFromBatch(lastToolBatch) ?? referencingPrefetchRaw;
  const correctedRef = correctReferencingInboundReply(corrected, prefetchMerged, referencingInboundDigest);
  const { reply: cleaned, suggestedActions } = mergeCompleteReplySuggestedActions(correctedRef, lastToolBatch);
  return {
    outcome: "complete",
    reply: stripCeoHexUuidsFromText(cleaned),
    ...(suggestedActions.length > 0 ? { suggestedActions } : {}),
  };
}

/** Best-effort name after "for …" / "about …" so we can prefetch prepare_referencing without tool calls. */
function extractTenantNameForReferencingQuery(message: string): string | null {
  const t = message.trim();
  const patterns = [
    /\b(?:referencing|reference)\b[^?.!\n]{0,160}?\bfor\s+([A-Za-z][A-Za-z\s'.-]{1,80})(?:\s*[?.!]|$)/i,
    /\bupdate\s+for\s+([A-Za-z][A-Za-z\s'.-]{1,80})(?:\s*[?.!]|$)/i,
    /\bfor\s+([A-Za-z][A-Za-z\s'.-]{1,80})(?:\s*[?.!]|$)/i,
    /\babout\s+([A-Za-z][A-Za-z\s'.-]{1,80})(?:\s*[?.!]|$)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m?.[1]) {
      const name = m[1].trim();
      if (name.length >= 2 && !/^(the|a|an|my|our|this|that|any)$/i.test(name)) return name;
    }
  }
  return null;
}

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

    const referencingInboundDigest = await fetchReferencingInboundDigestForCeo(userId, supabase);

    const resultBlocks: string[] = [];
    const rawBatch: { name: CEOToolName; raw: string }[] = [];
    for (const call of pendingAction.toolCalls) {
      const input =
        call.name === "start_tenant_onboarding"
          ? mergeEnrichedOnboardingInput(call.input, inferredOnboardingName)
          : call.input;
      const raw = await executeCEOTool(call.name, input, userId, supabase);
      rawBatch.push({ name: call.name, raw });
      resultBlocks.push(wrapToolResultForModel(call.name, raw));
    }

    const summarySystemPrompt =
      CEO_SYSTEM_PROMPT +
      (referencingInboundDigest ? `\n\n${referencingInboundDigest}` : "") +
      "\n\nThe landlord already confirmed the pending actions. Tool runs are complete. Summarize outcomes in natural language. Do not ask for confirmation again." +
      "\n\n**Mandatory for tool JSON:** If any result has `success`: false or an `error` string, say exactly what failed using the `message` or `error` field (e.g. missing email, onboarding already started). **Do not** claim the system rejected a plain-name input, or cite UUID/form validation errors, unless those exact words appear in the JSON." +
      "\n\n**Product truth:** Letora does not have a tenant portal or tenant app. Tenants are reached by **email**. Onboarding **tasks** are for the **landlord** in the dashboard. **Never** tell the user that tenants will see a checklist in a portal or log in to Letora.";
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
      return completeWithSuggestedActions(extractFinalText(summaryResp), rawBatch, null);
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
        return completeWithSuggestedActions(reply, rawBatch, null);
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

  const referencingInboundDigest = await fetchReferencingInboundDigestForCeo(userId, supabase);
  if (referencingInboundDigest) {
    effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n${referencingInboundDigest}`;
  }

  /** So the model cannot end_turn with “no agency reply” before calling tools — same JSON as prepare_referencing. */
  let referencingPrefetchRaw: string | null = null;
  if (route.wantsReferencingStatus) {
    const tenantGuess = extractTenantNameForReferencingQuery(latestUser);
    if (tenantGuess) {
      referencingPrefetchRaw = await executeCEOTool(
        "prepare_referencing",
        { tenant_name: tenantGuess },
        userId,
        supabase,
      );
      effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n**Server-fetched referencing status (authoritative — your answer MUST match this JSON):**\n${referencingPrefetchRaw}\n\nIf **recent_inbound_mail** is a non-empty array, you MUST summarize what Letora recorded (preview text) and MUST NOT claim the agency sent no reply or that there are no inbound updates.`;
    }
  }

  const intent = classifyCEOIntent(latestUser);
  const conversation: MessageParam[] = contextMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let lastToolBatch: { name: CEOToolName; raw: string }[] = [];

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
        return completeWithSuggestedActions(
          reply,
          [],
          authoritativeLeadsRaw,
          referencingPrefetchRaw,
          referencingInboundDigest,
        );
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
      return completeWithSuggestedActions(
        extractFinalText(response),
        lastToolBatch,
        authoritativeLeadsRaw,
        referencingPrefetchRaw,
        referencingInboundDigest,
      );
    }

    conversation.push({ role: "assistant", content: response.content });
    const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (toolUseBlocks.length === 0) {
      return completeWithSuggestedActions(
        extractFinalText(response),
        lastToolBatch,
        authoritativeLeadsRaw,
        referencingPrefetchRaw,
        referencingInboundDigest,
      );
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

    const executed = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const toolName = block.name as CEOToolName;
        const args = block.input as Record<string, string>;
        const result = await executeCEOTool(toolName, args, userId, supabase);
        if (toolName === "get_leads_summary") {
          authoritativeLeadsRaw = result;
        }
        return {
          toolName,
          result,
          block,
        };
      }),
    );
    lastToolBatch = executed.map((e) => ({ name: e.toolName, raw: e.result }));
    const toolResults = executed.map((e) => ({
      type: "tool_result" as const,
      tool_use_id: e.block.id,
      content: wrapToolResultForModel(e.toolName, e.result),
    }));
    conversation.push({ role: "user", content: toolResults });
  }

  return completeWithSuggestedActions(
    "I'm having trouble completing this request. Please try again.",
    lastToolBatch,
    authoritativeLeadsRaw,
    referencingPrefetchRaw,
    referencingInboundDigest,
  );
}

export async function runCEOAgent(options: CEOAgentOptions): Promise<string> {
  const result = await runCEOChat(options);
  if (result.outcome === "needs_clarification") return result.message;
  if (result.outcome === "needs_confirmation") return result.message;
  return result.reply;
}
