import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  Message,
  MessageParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages";

import { injectAuthoritativeCurrentDateBlock } from "./current-date-for-model";
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
  normalizeCEOToolInput,
  pendingActionFromToolUseBlocks,
  stripCeoHexUuidsFromText,
  stripNavigateActionTagsFromAssistantText,
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
  draftContractMergeHasResolvableArgs,
  inferOnboardingForFromConversation,
  inferPropertyAddressHintFromConversation,
  inferPropertyAddressHintFromUserMessagesOnly,
  inferTenantOrContractNameFromConversation,
  mergeDraftContractInput,
  mergeEnrichedOnboardingInput,
  scrubDraftContractTenancyIdForMerge,
  userRequestsDraftContractInMessage,
} from "./enrich-onboarding-input";
import {
  buildCeoFailureThrottleKey,
  shouldInsertSystemAlertRow,
  shouldSendAdminAlertEmail,
} from "@/lib/alerts/alert-throttle";
import { createSystemAlert, notifyAdminByEmail } from "@/lib/alerts/admin-alerts";
import { fetchReferencingInboundDigestForCeo } from "@/lib/referencing/inbound-digest";
import {
  CEO_TOOL_NUDGE_USER_MESSAGE,
  replyLooksLikeDeferredToolPromise,
  shouldForceToolChoiceOnFirstTurn,
} from "./ceo-tool-first-turn";

export type { PendingCEOAction } from "./safety";
export { parsePendingCEOActionFromJson } from "./safety";
export type { LetoraSuggestedAction } from "./suggested-actions";
export type { CEOIntentRoute, CEOPropertyIntentId } from "./intent-router";
export { formatRouterHintForSystem, routeCEOIntent } from "./intent-router";

import { runDeepSeek } from "@/lib/llm/providers/deepseek";
import { AGENT_MODEL_CONFIG, DEEPSEEK_CONFIG } from "@/lib/llm/config";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Default model IDs from config.ts are preferred; we keep these for legacy fallback logic.
const ANTHROPIC_CEO_MODEL = process.env.ANTHROPIC_CEO_MODEL?.trim() || "claude-haiku-4-5";
const geminiApiKey = process.env.GOOGLE_AI_API_KEY?.trim();
const geminiClient = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

/**
 * Universal completion wrapper for the CEO agent.
 * Handles switching between Anthropic and DeepSeek (OpenAI-compatible).
 */
async function executeCeoCompletion(params: {
  system: string;
  messages: MessageParam[];
  tools?: any[];
  tool_choice?: any;
  max_tokens?: number;
}): Promise<Message> {
  const provider = AGENT_MODEL_CONFIG.ceo.provider;
  const model = AGENT_MODEL_CONFIG.ceo.model;
  const { system, messages, tools, tool_choice, max_tokens = 2048 } = params;

  // Mandatory log for production confirmation
  const isReasoning = model === DEEPSEEK_CONFIG.reasoningModel;
  console.log(`[ceo] DeepSeek call: model=${model}, is_reasoning=${isReasoning} (agent=ceo)`);

  if (provider === "deepseek") {
    const dsMessages: any[] = [];
    messages.forEach(m => {
      if (Array.isArray(m.content)) {
        const toolUseBlocks = m.content.filter(c => c.type === "tool_use");
        const toolResultBlocks = m.content.filter(c => c.type === "tool_result");
        
        if (toolUseBlocks.length > 0) {
          dsMessages.push({
            role: "assistant",
            content: m.content.filter(c => c.type === "text").map((c: any) => (c as any).text).join("\n") || null,
            tool_calls: toolUseBlocks.map(c => ({
              id: (c as any).id,
              type: "function",
              function: {
                name: (c as any).name,
                arguments: JSON.stringify((c as any).input)
              }
            }))
          });
        } else if (toolResultBlocks.length > 0) {
          toolResultBlocks.forEach((c: any) => {
            dsMessages.push({
              role: "tool",
              tool_call_id: c.tool_use_id,
              content: typeof c.content === "string" ? c.content : JSON.stringify(c.content)
            });
          });
        } else {
          dsMessages.push({
            role: m.role,
            content: m.content.map((c: any) => c.text || "").join("\n")
          });
        }
      } else {
        dsMessages.push({ role: m.role, content: m.content });
      }
    });

    const dsResponse = await runDeepSeek({
      agentName: "ceo",
      messages: dsMessages as any,
      system,
      tools,
      tool_choice,
      maxTokens: max_tokens,
    });

    const choice = dsResponse.rawResponse?.choices?.[0];
    const message = choice?.message;

    // Convert OpenAI response back to Anthropic Message format for Letora's loop
    const content: any[] = [];
    if (message?.content) {
      content.push({ type: "text", text: message.content });
    }
    if (message?.tool_calls) {
      message.tool_calls.forEach((tc: any) => {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments)
        });
      });
    }

    return {
      id: dsResponse.rawResponse?.id || `ds-${Date.now()}`,
      role: "assistant",
      content,
      model: dsResponse.model,
      stop_reason: choice?.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
      stop_sequence: null,
      usage: dsResponse.rawResponse?.usage
        ? {
            input_tokens: dsResponse.rawResponse.usage.prompt_tokens || 0,
            output_tokens: dsResponse.rawResponse.usage.completion_tokens || 0,
          }
        : { input_tokens: 0, output_tokens: 0 },
    } as Message;
  }

  // Default to Anthropic
  return await anthropic.messages.create({
    model: ANTHROPIC_CEO_MODEL,
    max_tokens,
    system,
    messages,
    tools,
    tool_choice,
  });
}

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
  /** Injected block from `checkPortfolioHealth` when compliance rows are expired. */
  portfolioHealthDigest?: string | null;
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

/**
 * Model invents “persistent technical issue / only way is dashboard / cannot bypass” even when tools
 * returned JSON or never ran. Match broadly so server-side correction can fire.
 */
function replyClaimsManualDashboardContractExcuse(reply: string): boolean {
  const t = reply.toLowerCase();
  return (
    /\b(?:persistent|consistent)\s+technical\b/i.test(t) ||
    /\btechnical\s+(?:barrier|issue)\b/i.test(t) ||
    /\bonly\s+way\s+to\s+(?:proceed|draft|continue)\b/i.test(t) ||
    /\b(?:must|need\s+to|have\s+to)\s+.*\b(?:dashboard|\/dashboard)\b/i.test(t) ||
    /\b(?:cannot|can'?t)\s+bypass\b/i.test(t) ||
    /\bunable\s+to\s+(?:draft|complete|create)\b/i.test(t) ||
    /\bunable\s+to\s+.*\b(?:chat|here)\b/i.test(t) ||
    /\bdraft\s+manually\b/i.test(t) ||
    /\bvisit\s+.*\/dashboard\/contracts\b/i.test(t) ||
    /\bsearch\s+for\s+.*\s+and\s+create\b/i.test(t) ||
    /\bapologize\s+for\s+the\s+(?:limitation|repeated)\b/i.test(t) ||
    /\bunderstand\s+your\s+frustration\b/i.test(t) ||
    /\bbackend\s+(?:issue|synchronization)|sync\s+issue\b/i.test(t) ||
    /\b(backend|cannot|can'?t)\s+resolve\b/i.test(t) ||
    /\btenant\s+(?:profile|record)\b/i.test(t) ||
    /\bconfiguration\s+issue\b/i.test(t) ||
    /\bmanual(ly)?\s+from\s+\/dashboard\/contracts\b/i.test(t) ||
    /\bthe\s+system\s+is\s+unable\b/i.test(t) ||
    /\b(?:unable|cannot|can'?t)\b.*\bvia\s+chat\b/i.test(t) ||
    /\bvia\s+chat\b.*\b(?:unable|cannot|can'?t|won'?t)\b/i.test(t)
  );
}

/** @deprecated use replyClaimsManualDashboardContractExcuse */
function replyClaimsDraftOrTenancyFailure(reply: string): boolean {
  return replyClaimsManualDashboardContractExcuse(reply);
}

/**
 * Model often claims “technical barrier / must use dashboard” even when **draft_contract** already ran,
 * or **without calling the tool at all**. Replace with tool JSON or onboarding prefetch truth.
 */
function correctDraftContractHallucinationReply(
  reply: string,
  lastToolBatch: readonly { name: CEOToolName; raw: string }[],
  onboardingPrefetchRaw: string | null,
  latestUserMessage: string,
): string {
  const isDraftRelatedMessage =
    /\b(draft|contract|tenancy\s+agreement|tenancy\s+contract)\b/i.test(latestUserMessage);
  const lastDraft = [...lastToolBatch].reverse().find((t) => t.name === "draft_contract");
  if (!isDraftRelatedMessage && !lastDraft) return reply;

  const bad = replyClaimsManualDashboardContractExcuse(reply);

  /** Model end_turn’d with excuses but never called **draft_contract** — still replace if we have prefetch or strong boilerplate. */
  if (!lastDraft) {
    if (!bad || !onboardingPrefetchRaw) return reply;
    try {
      const o = JSON.parse(onboardingPrefetchRaw) as {
        success?: boolean;
        mode?: string;
        tenant_name?: string;
        tenancy_id?: string;
        referencing_complete?: boolean;
        pending_task_names?: string[];
      };
      const hasTenancy =
        typeof o.tenancy_id === "string" &&
        o.tenancy_id.length > 0 &&
        (o.success === true || o.mode === "resume");
      if (hasTenancy) {
        const name = (o.tenant_name ?? "This tenant").trim();
        const pending = Array.isArray(o.pending_task_names) ? o.pending_task_names.join("; ") : "";
        const refLine = o.referencing_complete
          ? "Referencing is marked complete for this tenancy."
          : "Referencing may still be in progress. Finish that before the tenancy agreement, unless you want to force a draft.";
        const pendingLine = pending ? `Outstanding tasks: ${pending}` : "";
        return [
          `${name} is already on your Letora account, so a tenancy agreement can be drafted from this chat.`,
          refLine,
          pendingLine,
          "",
          "Ask me to draft the tenancy agreement again when you want to continue.",
        ]
          .filter((line) => line.length > 0)
          .join("\n");
      }
    } catch {
      /* ignore */
    }
    return reply;
  }

  let p: {
    saved?: boolean;
    error?: string;
    message?: string;
    code?: string;
    contract_id?: string;
    tenant_name?: string;
  };
  try {
    p = JSON.parse(lastDraft.raw) as typeof p;
  } catch {
    return reply;
  }

  if (p.saved === true) {
    if (!bad && /\b(saved|draft\s+was|successfully)\b/i.test(reply)) return reply;
    if (bad || /\b(failed|unable|cannot|barrier|dashboard\s+only|limitation)\b/i.test(reply)) {
      return [
        `A tenancy agreement draft was saved for ${p.tenant_name?.trim() || "the tenant"}.`,
        "Open **Contracts** in the app to review or edit it.",
        "",
        "If something still looks wrong, say what you expected and we can adjust.",
      ].join("\n");
    }
    return reply;
  }

  const errText =
    typeof p.error === "string" && p.error.trim() !== ""
      ? p.error.trim()
      : typeof p.message === "string"
        ? p.message.trim()
        : "";
  if (errText !== "") {
    const code = typeof p.code === "string" ? p.code : "unknown";

    if (code === "no_property_match") {
      const tenantPart =
        typeof p.tenant_name === "string" && p.tenant_name.trim() !== ""
          ? `I found the tenant **${p.tenant_name.trim()}** in your account but couldn't match a property.`
          : "I couldn't match a property on your account.";
      return `${tenantPart}\nWhich property should this tenancy agreement be for? You can say the address or ask me to list your properties.`;
    }

    if (bad || /\b(must\s+go|dashboard|manually|only\s+way|bypass|unable\s+to)\b/i.test(reply)) {
      const tenantLine =
        typeof p.tenant_name === "string" && p.tenant_name.trim() !== ""
          ? ` Tenant: ${p.tenant_name.trim()}.`
          : "";
      const tail =
        code === "referencing_incomplete"
          ? " Finish referencing first, or ask to override only if you want to force a draft."
          : " Check the tenant name and address, or ask for a list of tenants to pick the right person.";
      return `The tenancy agreement draft did not go through. ${errText}.${tenantLine}${tail}`;
    }
  }

  return reply;
}

/**
 * Model often end_turns with “backend issue / can’t resolve tenant” even when the DB has the tenant.
 * If we prefetched onboarding JSON successfully, replace that narrative with tool truth.
 */
function correctOnboardingHallucinationReply(
  reply: string,
  onboardingPrefetchRaw: string | null,
  lastToolBatch: readonly { name: CEOToolName; raw: string }[],
): string {
  const trim = reply.trim();
  if (
    /^The \*\*draft_contract\*\* tool returned this/m.test(trim) ||
    /^A tenancy (?:agreement|contract) draft was \*\*saved\*\*/m.test(trim) ||
    /^No \*\*draft_contract\*\* tool ran/m.test(trim) ||
    /^\*\*[^\n]+\*\* is on file with a \*\*tenancy_id\*\*/m.test(trim)
  ) {
    return reply;
  }

  const claimsFailure = replyClaimsDraftOrTenancyFailure(reply);

  if (!claimsFailure) return reply;

  const lastDraft = [...lastToolBatch].reverse().find((t) => t.name === "draft_contract");
  if (lastDraft) {
    try {
      const p = JSON.parse(lastDraft.raw) as { saved?: boolean; error?: string };
      if (p.saved === true) return reply;
    } catch {
      /* ignore */
    }
  }

  if (!onboardingPrefetchRaw) return reply;

  try {
    const o = JSON.parse(onboardingPrefetchRaw) as {
      success?: boolean;
      mode?: string;
      tenant_name?: string;
      tenancy_id?: string;
      pending_task_names?: string[];
      referencing_complete?: boolean;
      message?: string;
    };
    const hasTenancyRecord =
      typeof o.tenancy_id === "string" &&
      o.tenancy_id.length > 0 &&
      (o.success === true || o.mode === "resume");
    if (!hasTenancyRecord) return reply;

    const name = (o.tenant_name ?? "This tenant").trim();
    const pending = Array.isArray(o.pending_task_names) ? o.pending_task_names.join("; ") : "—";
    const refDone = o.referencing_complete === true;

    return [
      `${name} is on your Letora account and is not missing from the system.`,
      refDone ? "Referencing is complete for this tenancy." : "Referencing may still be in progress. Finish that before the tenancy agreement, unless you want to force a draft.",
      pending !== "—" ? `Outstanding tasks: ${pending}` : "",
      "",
      "You can ask me to draft the tenancy agreement in this chat when you are ready.",
    ]
      .filter((line) => line.length > 0)
      .join("\n");
  } catch {
    return reply;
  }
}

function pickPrepareReferencingRawFromBatch(
  lastToolBatch: readonly { name: CEOToolName; raw: string }[],
): string | null {
  for (let i = lastToolBatch.length - 1; i >= 0; i--) {
    if (lastToolBatch[i]!.name === "prepare_referencing") return lastToolBatch[i]!.raw;
  }
  return null;
}

/**
 * Each agent loop overwrites **lastToolBatch**; if a later turn only runs e.g. **list_tenants**, we would
 * lose the JSON from an earlier **draft_contract** — merge the last draft result back in for correction.
 */
function buildToolBatchForCorrection(
  lastToolBatch: readonly { name: CEOToolName; raw: string }[],
  lastDraftContractRaw: string | null,
): { name: CEOToolName; raw: string }[] {
  if (!lastDraftContractRaw || lastToolBatch.some((t) => t.name === "draft_contract")) {
    return [...lastToolBatch];
  }
  return [...lastToolBatch, { name: "draft_contract", raw: lastDraftContractRaw }];
}

/** The model often ignores injected JSON and returns end_turn with “0 leads”; override with DB truth. */
function completeWithSuggestedActions(
  reply: string,
  lastToolBatch: readonly { name: CEOToolName; raw: string }[],
  authoritativeLeadsRaw: string | null,
  referencingPrefetchRaw: string | null = null,
  referencingInboundDigest: string | null = null,
  onboardingPrefetchRaw: string | null = null,
  lastDraftContractRaw: string | null = null,
  latestUserMessage: string = "",
): { outcome: "complete"; reply: string; suggestedActions?: LetoraSuggestedAction[] } {
  const toolBatchForCorrection = buildToolBatchForCorrection(lastToolBatch, lastDraftContractRaw);
  const corrected = correctLeadReplyAgainstAuthoritative(reply, authoritativeLeadsRaw);
  const prefetchMerged = pickPrepareReferencingRawFromBatch(toolBatchForCorrection) ?? referencingPrefetchRaw;
  const correctedRef = correctReferencingInboundReply(corrected, prefetchMerged, referencingInboundDigest);
  const correctedDraft = correctDraftContractHallucinationReply(
    correctedRef,
    toolBatchForCorrection,
    onboardingPrefetchRaw,
    latestUserMessage,
  );
  const correctedOnboarding = correctOnboardingHallucinationReply(
    correctedDraft,
    onboardingPrefetchRaw,
    toolBatchForCorrection,
  );
  const { reply: cleaned, suggestedActions } = mergeCompleteReplySuggestedActions(
    correctedOnboarding,
    toolBatchForCorrection,
  );
  return {
    outcome: "complete",
    reply: stripCeoHexUuidsFromText(stripNavigateActionTagsFromAssistantText(cleaned)),
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

function appendPortfolioHealthDigest(base: string, digest: string | null | undefined): string {
  const d = digest?.trim();
  if (!d) return base;
  return `${base}\n\n${d}`;
}

export async function runCEOChat(options: CEOAgentOptions): Promise<CEOChatResult> {
  const { userId, supabase, messages, confirmedExecution, pendingAction, portfolioHealthDigest } = options;
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
          : call.name === "draft_contract"
            ? mergeDraftContractInput(
                scrubDraftContractTenancyIdForMerge(
                  call.input,
                  null,
                  inferTenantOrContractNameFromConversation(contextMessages),
                  inferPropertyAddressHintFromConversation(contextMessages),
                  inferPropertyAddressHintFromUserMessagesOnly(contextMessages),
                ),
                inferTenantOrContractNameFromConversation(contextMessages),
                inferPropertyAddressHintFromConversation(contextMessages),
                null,
                inferPropertyAddressHintFromUserMessagesOnly(contextMessages),
              )
            : call.input;
      const raw = await executeCEOTool(call.name, input, userId, supabase);
      rawBatch.push({ name: call.name, raw });
      resultBlocks.push(wrapToolResultForModel(call.name, raw));
    }

    const summarySystemPrompt = appendPortfolioHealthDigest(
      CEO_SYSTEM_PROMPT +
        `\n\n${injectAuthoritativeCurrentDateBlock()}` +
        (referencingInboundDigest ? `\n\n${referencingInboundDigest}` : "") +
        "\n\nThe landlord already confirmed the pending actions. Tool runs are complete. Summarize outcomes in natural language. Do not ask for confirmation again." +
      "\n\n**Operational vocabulary:** Prefer **drafted**, **proposed**, **pending approval**, **sent**, **completed**, **blocked** — match each phrase to the tool JSON (e.g. **email_sent**, **pending_approval**, **success**, **saved**). If something is still in Approvals, tell them to check **/dashboard/approvals**." +
      "\n\n**Mandatory for tool JSON:** If any result has `success`: false or an `error` string, say exactly what failed using the `message` or `error` field (e.g. missing email, onboarding already started). **Do not** claim the system rejected a plain-name input, or cite UUID/form validation errors, unless those exact words appear in the JSON." +
      "\n\n**draft_contract results:** If JSON has **saved: true**, confirm the draft was saved. If JSON has **error** and **code**, quote them. **Never** say “technical barrier”, “persistent issue”, “only the dashboard”, or “cannot bypass” unless those exact phrases appear in the **error** string." +
      "\n\n**Product truth:** Letora does not have a tenant portal or tenant app. Tenants are reached by **email**. Onboarding **tasks** are for the **landlord** in the dashboard. **Never** tell the user that tenants will see a checklist in a portal or log in to Letora." +
      "\n\n**Money boundary:** Letora does **not** collect tenant rent, custody funds, or pay landlords. Describe rent chases as **drafts** / **pending approval** / comms only — never imply in-app payment collection or payouts ran." +
      "\n\n**Prioritization:** Lead with the highest-impact outcome (e.g. **pending approval** vs **sent** vs **blocked**). If any result left work in **Approvals**, say reviewing **/dashboard/approvals** is the operator next step before treating outbound comms as done." +
      "\n\n**Within-bucket ranking:** When multiple rows appear in one tool’s JSON, order by severity using only fields present (**days_overdue**, **amount_owed**, **email_sent**, **priority**, **status**, **due_date**, etc.). State **why** the top row wins. If the JSON does not support fine ordering, say that — do not invent relative urgency." +
      "\n\n**Patterns (this batch only):** You may mention a **repeated blocker** or **pattern to watch** only if the **same** issue appears across **multiple** rows or tool results **in this confirmed batch** — hedged wording, no historical trends, no memory beyond this summary. If the shared blocker is obvious, name it once before listing examples.",
      portfolioHealthDigest,
    );
    const summaryMessages: MessageParam[] = [
      {
        role: "user",
        content: "Confirmed action — tool results (internal):\n\n" + resultBlocks.join("\n---\n"),
      },
    ];
    try {
      const summaryResp = await executeCeoCompletion({
        max_tokens: 2048,
        system: summarySystemPrompt,
        messages: summaryMessages,
      });
      const draftFromPendingBatch =
        [...rawBatch].reverse().find((t) => t.name === "draft_contract")?.raw ?? null;
      return completeWithSuggestedActions(
        extractFinalText(summaryResp),
        rawBatch,
        null,
        null,
        null,
        null,
        draftFromPendingBatch,
        latest,
      );
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
        const draftFromPendingBatch =
          [...rawBatch].reverse().find((t) => t.name === "draft_contract")?.raw ?? null;
        return completeWithSuggestedActions(reply, rawBatch, null, null, null, null, draftFromPendingBatch, latest);
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
  const dateBlock = injectAuthoritativeCurrentDateBlock();
  const systemPrompt = appendPortfolioHealthDigest(
    routerHint
      ? `${CEO_SYSTEM_PROMPT}\n\n${routerHint}\n\n${dateBlock}`
      : `${CEO_SYSTEM_PROMPT}\n\n${dateBlock}`,
    portfolioHealthDigest,
  );

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

  const conversation: MessageParam[] = contextMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  if (route.wantsApprovalsQueueInspection) {
    const approvalsRaw = await executeCEOTool("get_pending_approvals_summary", {}, userId, supabase);
    const approvalsToolBatch: { name: CEOToolName; raw: string }[] = [
      { name: "get_pending_approvals_summary", raw: approvalsRaw },
    ];
    const approvalsSummarySystem = `${effectiveSystemPrompt}\n\n**Server already ran get_pending_approvals_summary for this user message. Tool JSON (authoritative — your reply MUST follow this data only):**\n${approvalsRaw}\n\n**Mandatory:** Summarize the Approvals queue in plain text only. Include **pending_total**, **by_category** (onboarding, rent_chase, move_in, maintenance), **oldest_waiting_label** when the queue is non-empty (say the queue is empty otherwise), and a short bullet list from **items** (use **title** and **category**). End with the **next_action** path from JSON (open /dashboard/approvals). Do **not** ask the user to reply **yes** or **no** to proceed. Do **not** offer to approve, reject, or send items from chat. Do not call tools.`;

    try {
      const approvalsSummaryResp = await executeCeoCompletion({
        max_tokens: 2048,
        system: approvalsSummarySystem,
        messages: conversation,
      });
      return completeWithSuggestedActions(
        extractFinalText(approvalsSummaryResp),
        approvalsToolBatch,
        authoritativeLeadsRaw,
        null,
        referencingInboundDigest,
        null,
        null,
        latestUser,
      );
    } catch (anthropicError) {
      await runAdminFailureAlert({
        stage: "anthropic_loop",
        error: anthropicError,
        userId,
      });
      try {
        const reply = await runGeminiFallback({
          systemPrompt: approvalsSummarySystem,
          conversation,
        });
        return completeWithSuggestedActions(
          reply,
          approvalsToolBatch,
          authoritativeLeadsRaw,
          null,
          referencingInboundDigest,
          null,
          null,
          latestUser,
        );
      } catch (geminiError) {
        console.error("[ceo] gemini fallback failure", {
          stage: "approvals_queue_summary",
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

  /** Same pattern as referencing: prefetch resume JSON so the model cannot “invent” missing tenants. */
  let onboardingPrefetchRaw: string | null = null;
  let onboardingStatePrefetchRaw: string | null = null;
  const inferredTenantName = inferTenantOrContractNameFromConversation(contextMessages);
  const inferredPropertyHint = inferPropertyAddressHintFromConversation(contextMessages);
  const inferredPropertyHintFromUser = inferPropertyAddressHintFromUserMessagesOnly(contextMessages);

  const lastAssistantReply =
    [...contextMessages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const isPropertyAddressFollowUp =
    /couldn.{0,5}t (?:match|find) .{0,20}property|which property should|which property.*contract/i.test(
      lastAssistantReply,
    ) &&
    Boolean(inferredPropertyHintFromUser) &&
    Boolean(inferredTenantName);

  /** Avoid running **start_tenant_onboarding** as a hidden prefetch when the user is creating a new tenancy/tenant from freeform (would mutate before confirmation). */
  const looksLikeNewTenantTenancyCreation =
    (/\b(create|add|set\s+up)\b/i.test(latestUser) && /\b(tenant|tenancy)\b/i.test(latestUser)) ||
    (/\bonboard\b/i.test(latestUser) && /\bcreate\b/i.test(latestUser) && /\btenancy\b/i.test(latestUser));

  if (route.wantsOnboardingStateInspection && inferredTenantName) {
    onboardingStatePrefetchRaw = await executeCEOTool(
      "resolve_onboarding_navigation",
      { tenant_name: inferredTenantName },
      userId,
      supabase,
    );
    effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n**Server-fetched onboarding state snapshot (read-first; authoritative):**\n${onboardingStatePrefetchRaw}\n\nFor “what next / stage / blocker” onboarding questions: return current stage, completed steps, blocker (if any), and next valid step first. Do not start/restart onboarding or create tenant/tenancy records unless this snapshot proves no existing tenancy/onboarding and the landlord explicitly asks you to proceed.`;
  }

  const wantsOnboardingPrefetch =
    Boolean(inferredTenantName) &&
    !route.wantsReferencingStatus &&
    !route.wantsOnboardingStateInspection &&
    !looksLikeNewTenantTenancyCreation &&
    (route.wantsContinueOnboarding ||
      route.wantsOnboardingByPlainName ||
      route.primaryIntent === "onboarding" ||
      route.primaryIntent === "contracts" ||
      isPropertyAddressFollowUp ||
      /\b(next\s+step|next\s+thing|what'?s\s+next|draft|contract|tenancy|onboarding|welcome|move[-\s]?in|what\s+to\s+do)\b/i.test(
        latestUser,
      ));

  if (wantsOnboardingPrefetch && inferredTenantName) {
    onboardingPrefetchRaw = await executeCEOTool(
      "start_tenant_onboarding",
      { onboarding_for: inferredTenantName },
      userId,
      supabase,
    );
    effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n**Server-fetched onboarding (authoritative — your answer MUST match this JSON; never claim the tenant cannot be resolved by name):**\n${onboardingPrefetchRaw}\n\n**Mandatory:** The server may auto-fill **tenancy_id** on **draft_contract** from this JSON — you do not need UUIDs from the user. Use **tenancy_id**, **pending_task_names**, and **referencing_complete** from this JSON. To draft a **tenancy agreement** in chat, call **draft_contract** (args can be empty if this block is present). Prefer **tenant_name** as **${inferredTenantName}** and **onboarding_property_hint** when the user gave a street (e.g. Billionaires Row). **Do not** invent “backend issues”, “tenant profile not loading”, or “draft manually from /dashboard/contracts” unless a tool JSON returned a real **error** field.`;
  }

  if (isPropertyAddressFollowUp && inferredPropertyHintFromUser) {
    effectiveSystemPrompt = `${effectiveSystemPrompt}\n\nThe user\'s previous message was a property address reply to your clarifying question. Use it as the \`onboarding_property_hint\` and retry \`draft_contract\` immediately. Do not ask for the property again.`;
  }

  const intent = classifyCEOIntent(latestUser);

  let lastToolBatch: { name: CEOToolName; raw: string }[] = [];
  /** Latest **draft_contract** JSON in this agent loop (survives later turns that overwrite **lastToolBatch**). */
  let lastDraftContractRaw: string | null = null;

  /**
   * When the user clearly asks to draft a contract and we can resolve args from prefetch + chat,
   * run **draft_contract** server-side and summarize in one text-only turn. Stops the model from
   * end_turn-ing with dashboard/“technical barrier” copy without calling the tool (which triggered
   * correctDraftContractHallucinationReply’s meta-message).
   */
  const mergedDraftArgs = mergeDraftContractInput(
    scrubDraftContractTenancyIdForMerge(
      {},
      onboardingPrefetchRaw,
      inferredTenantName,
      inferredPropertyHint,
      inferredPropertyHintFromUser,
    ),
    inferredTenantName,
    inferredPropertyHint,
    onboardingPrefetchRaw,
    inferredPropertyHintFromUser,
  );
  /** Do not gate on intent-router `recommendedTools` — it can omit `draft_contract` and skip server-side draft entirely. */
  const draftContractToolPressure =
    (intent === "draft_suggest" &&
      userRequestsDraftContractInMessage(latestUser) &&
      (draftContractMergeHasResolvableArgs(mergedDraftArgs) || Boolean(onboardingPrefetchRaw))) ||
    (isPropertyAddressFollowUp && Boolean(onboardingPrefetchRaw));

  const shouldAutoRunDraftContract =
    (intent === "draft_suggest" &&
      userRequestsDraftContractInMessage(latestUser) &&
      draftContractMergeHasResolvableArgs(mergedDraftArgs)) ||
    (isPropertyAddressFollowUp && draftContractMergeHasResolvableArgs(mergedDraftArgs));

  if (shouldAutoRunDraftContract) {
    const draftRaw = await executeCEOTool("draft_contract", mergedDraftArgs, userId, supabase);
    let code: string | undefined;
    try {
      const p = JSON.parse(draftRaw) as { code?: string };
      code = typeof p.code === "string" ? p.code : undefined;
    } catch {
      /* ignore */
    }
    const allowShortCircuit = code !== "missing_tenant";
    if (allowShortCircuit) {
      lastToolBatch = [{ name: "draft_contract", raw: draftRaw }];
      lastDraftContractRaw = draftRaw;
      const draftSummarySystem = `${effectiveSystemPrompt}\n\n**Server already ran draft_contract for this user message. Tool JSON (authoritative — your reply MUST follow this data only):**\n${draftRaw}\n\n**Mandatory:** Summarize the outcome in natural language only. If **saved** is true, confirm the draft was saved and mention the Contracts page in the app. If **code** is **matched_by_fallback**, ask whether the property in **message** is correct. If **code** is **ambiguous_match**, list **candidates** and ask which property. If **code** is **no_property_match**, use **message** in plain language and ask one clarifying question (e.g. which property they meant). Do not repeat the same error on the next turn. If **error** and **code** are present otherwise, explain briefly in plain English. Do not paste internal instructions or raw URLs. Do not call tools.`;

      try {
        const draftSummaryResp = await executeCeoCompletion({
          max_tokens: 2048,
          system: draftSummarySystem,
          messages: conversation,
        });
        return completeWithSuggestedActions(
          extractFinalText(draftSummaryResp),
          lastToolBatch,
          authoritativeLeadsRaw,
          referencingPrefetchRaw,
          referencingInboundDigest,
          onboardingPrefetchRaw,
          lastDraftContractRaw,
          latestUser,
        );
      } catch (anthropicError) {
        await runAdminFailureAlert({
          stage: "anthropic_loop",
          error: anthropicError,
          userId,
        });
        try {
          const reply = await runGeminiFallback({
            systemPrompt: draftSummarySystem,
            conversation,
          });
          return completeWithSuggestedActions(
            reply,
            lastToolBatch,
            authoritativeLeadsRaw,
            referencingPrefetchRaw,
            referencingInboundDigest,
            onboardingPrefetchRaw,
            lastDraftContractRaw,
            latestUser,
          );
        } catch (geminiError) {
          console.error("[ceo] gemini fallback failure", {
            stage: "draft_contract_auto_summary",
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
  }

  if (draftContractToolPressure && !shouldAutoRunDraftContract) {
    effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n**Mandatory:** The user asked to draft a tenancy contract. Call **draft_contract** or **list_tenants** (then **draft_contract**) — do not reply with only clarifying questions without tool results.`;
  }

  const forceToolChoiceOnFirstTurn = shouldForceToolChoiceOnFirstTurn(route);
  let forcedToolRetry = false;

  for (let i = 0; i < 5; i++) {
    const useToolChoiceAny =
      forcedToolRetry ||
      (i === 0 && (forceToolChoiceOnFirstTurn || draftContractToolPressure));

    let response: Message;
    try {
      response = await executeCeoCompletion({
        max_tokens: 2048,
        system: effectiveSystemPrompt,
        tools: CEO_TOOLS,
        messages: conversation,
        ...(useToolChoiceAny ? { tool_choice: { type: "any" as const } } : {}),
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
          onboardingPrefetchRaw,
          null,
          latestUser,
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

    const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    const assistantTextOnly = extractFinalText(response);

    if (toolUseBlocks.length === 0) {
      const shouldRetryWithoutTools =
        !route.needsClarification &&
        route.recommendedTools.length > 0 &&
        i < 4 &&
        (forcedToolRetry ||
          (i === 0 && (forceToolChoiceOnFirstTurn || draftContractToolPressure)) ||
          replyLooksLikeDeferredToolPromise(assistantTextOnly));

      if (shouldRetryWithoutTools) {
        conversation.push({ role: "user", content: CEO_TOOL_NUDGE_USER_MESSAGE });
        forcedToolRetry = true;
        continue;
      }

      return completeWithSuggestedActions(
        assistantTextOnly,
        lastToolBatch,
        authoritativeLeadsRaw,
        referencingPrefetchRaw,
        referencingInboundDigest,
        onboardingPrefetchRaw,
        lastDraftContractRaw,
        latestUser,
      );
    }

    conversation.push({ role: "assistant", content: response.content });
    forcedToolRetry = false;

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
        const normalized = normalizeCEOToolInput(block.input) as Record<string, string>;
        const args =
          toolName === "draft_contract"
            ? mergeDraftContractInput(
                scrubDraftContractTenancyIdForMerge(
                  normalized,
                  onboardingPrefetchRaw,
                  inferredTenantName,
                  inferredPropertyHint,
                  inferredPropertyHintFromUser,
                ),
                inferredTenantName,
                inferredPropertyHint,
                onboardingPrefetchRaw,
                inferredPropertyHintFromUser,
              )
            : normalized;
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
    for (const e of executed) {
      if (e.toolName === "draft_contract") lastDraftContractRaw = e.result;
    }
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
    onboardingPrefetchRaw,
    lastDraftContractRaw,
    latestUser,
  );
}

export async function runCEOAgent(options: CEOAgentOptions): Promise<string> {
  const result = await runCEOChat(options);
  if (result.outcome === "needs_clarification") return result.message;
  if (result.outcome === "needs_confirmation") return result.message;
  return result.reply;
}
