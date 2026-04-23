"use client";

import { Loader2, Menu, MessageSquarePlus, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { getPendingCeoActionFromMessages } from "@/lib/assistant/pending-ceo-from-messages";
import { AssistantConversationList } from "@/components/dashboard/assistant-conversation-list";
import type { AssistantConversationListItem } from "@/lib/assistant-messages/store";
import { stripNavigateActionTagsFromAssistantText, type PendingCEOAction } from "@/lib/agents/ceo/safety";
import type { LetoraSuggestedAction } from "@/lib/agents/ceo/suggested-actions";
import {
  parseLeadQualifyEmbed,
  type LeadQualifyEmbedPayloadV1,
} from "@/lib/assistant/lead-qualify-embed";
import { cn } from "@/lib/utils";
import {
  autonomousDelay,
  AUTONOMOUS_FOLLOWUP_DELAY_MS,
  isAutonomousContinuationSignal,
  MAX_AUTONOMOUS_FOLLOWUPS,
} from "./autonomous-continuation";

type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  suggestedActions?: LetoraSuggestedAction[];
  /** Present when assistant is waiting for Reply yes (persisted in DB metadata on refresh). */
  pendingCeoAction?: PendingCEOAction;
  /** UI-only flag: marks "please wait" messages with transitional styling. */
  isTransitional?: boolean;
}

function formatQualifyOutcomeRaw(raw: string): string {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (typeof j.error === "string") return j.error;
    if (j.parse_ok === false) {
      return typeof j.reason === "string" ? j.reason : JSON.stringify(j.details ?? j, null, 2);
    }
    const d = j.details as Record<string, unknown> | undefined;
    if (d && typeof d === "object") {
      const rec = d as {
        fullName?: string;
        score?: number;
        recommendation?: string;
        reasoning?: string;
      };
      const bits: string[] = [];
      if (rec.recommendation) bits.push(`Decision: ${rec.recommendation}`);
      if (rec.score != null) bits.push(`Score: ${rec.score}`);
      if (rec.reasoning) bits.push(String(rec.reasoning).slice(0, 400));
      if (bits.length) return bits.join("\n");
    }
    return JSON.stringify(j, null, 2).slice(0, 800);
  } catch {
    return raw.slice(0, 500);
  }
}

function LeadQualifyPanel({ payload }: { payload: LeadQualifyEmbedPayloadV1 }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [outcomeById, setOutcomeById] = useState<Record<string, string>>({});
  const [rowErr, setRowErr] = useState<string | null>(null);

  async function runQualify(leadId: string) {
    setRowErr(null);
    setLoadingId(leadId);
    try {
      const res = await fetch("/api/assistant/qualify-lead", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = (await res.json()) as { ok?: boolean; raw?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (typeof data.raw === "string") {
        setOutcomeById((prev) => ({ ...prev, [leadId]: data.raw as string }));
      }
    } catch (e) {
      setRowErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="font-headline text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Manual qualification
      </p>
      {rowErr ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-600 dark:text-red-400">
          {rowErr}
        </p>
      ) : null}
      <div className="space-y-2">
        {payload.leads.length === 0 ? (
          <p className="text-xs text-muted-foreground">No leads in your account yet.</p>
        ) : (
          payload.leads.map((row) => (
            <div
              key={row.id}
              className="rounded-lg border border-border bg-background p-3 text-left"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{row.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    Pipeline: {row.pipelineStatus ?? "—"} · Qualification:{" "}
                    {row.qualificationStatus ?? "—"}
                  </div>
                  {row.email ? (
                    <div className="truncate text-xs text-muted-foreground">{row.email}</div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!row.eligibleForAiQualify || loadingId === row.id}
                  title={
                    row.eligibleForAiQualify
                      ? "Run the Lead Qualifier on this lead"
                      : (row.ineligibleReason ?? "Not eligible")
                  }
                  className="shrink-0"
                  onClick={() => void runQualify(row.id)}
                >
                  {loadingId === row.id ? (
                    <>
                      <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
                      Running…
                    </>
                  ) : (
                    "Qualify with AI"
                  )}
                </Button>
              </div>
              {!row.eligibleForAiQualify && row.ineligibleReason ? (
                <p className="mt-2 text-xs text-muted-foreground">{row.ineligibleReason}</p>
              ) : null}
              {outcomeById[row.id] ? (
                <pre className="mt-2 max-h-40 overflow-auto rounded border border-border/60 bg-muted/50 p-2 text-xs whitespace-pre-wrap text-foreground">
                  {formatQualifyOutcomeRaw(outcomeById[row.id])}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
      <Link
        href="/dashboard/leads"
        className="inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Manage all leads →
      </Link>
    </div>
  );
}

function SuggestedActionChips({
  actions,
  onMessagePick,
}: {
  actions: LetoraSuggestedAction[];
  onMessagePick: (text: string) => void;
}) {
  const router = useRouter();
  return (
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Suggested actions">
      {actions.map((a) => (
        <Button
          key={a.id}
          type="button"
          size="sm"
          variant="secondary"
          className="h-auto min-h-8 max-w-full whitespace-normal rounded-full border border-border bg-muted text-left text-xs font-headline font-normal text-foreground hover:bg-accent"
          onClick={() => {
            if (a.kind === "link" && a.href) router.push(a.href);
            else if (a.kind === "message" && a.message) onMessagePick(a.message);
          }}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

interface ActionTag {
  label: string;
  href: string;
}

const NAVIGATE_ACTION_TAG = /<action\b[\s\S]*?type\s*=\s*["']navigate["'][\s\S]*?\/>/gi;

const CONTRACT_ID_PATTERN =
  /(?:contract\s*(?:id|ID)[:\s]+|\/dashboard\/contracts\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function isValidDashboardDeepLink(href: string): boolean {
  const h = href.trim();
  if (!h || h === "/" || h === "#") return false;
  if (!h.startsWith("/dashboard")) return false;
  if (/^\/dashboard\/?$/i.test(h)) return false;
  return true;
}

function parseActionTags(text: string): { cleanText: string; actions: ActionTag[] } {
  const actions: ActionTag[] = [];
  const withoutNavigate = text.replace(NAVIGATE_ACTION_TAG, (full) => {
    const labelM = /\blabel\s*=\s*"([^"]*)"/i.exec(full);
    const hrefM = /\bhref\s*=\s*"([^"]*)"/i.exec(full);
    const label = labelM?.[1]?.trim() ?? "";
    const href = hrefM?.[1]?.trim() ?? "";
    if (label && isValidDashboardDeepLink(href)) {
      actions.push({ label, href });
    }
    return "";
  });
  const cleanText = stripNavigateActionTagsFromAssistantText(withoutNavigate);

  if (actions.length === 0) {
    const cid = CONTRACT_ID_PATTERN.exec(text);
    if (cid?.[1]) {
      actions.push({ label: "Review tenancy agreement", href: `/dashboard/contracts/${cid[1]}` });
    }
  }

  return { cleanText, actions };
}

function NavigationButtons({ actions }: { actions: ActionTag[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3.5 py-1.5 font-headline text-xs font-medium text-foreground transition-colors hover:border-secondary/50"
        >
          {a.label}
          <span className="text-secondary" aria-hidden>
            →
          </span>
        </Link>
      ))}
    </div>
  );
}

function AssistantThinkingIndicator() {
  return (
    <div
      className="flex items-center gap-2 font-headline text-[0.75rem] font-medium tracking-wide text-muted-foreground"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Assistant is thinking</span>
      <span aria-hidden className="select-none">
        Assistant is thinking
      </span>
      <span className="inline-flex translate-y-px gap-1 pl-0.5" aria-hidden>
        <span className="assistant-thinking-dot inline-block size-[3px] rounded-full bg-current [animation-delay:0ms]" />
        <span className="assistant-thinking-dot inline-block size-[3px] rounded-full bg-current [animation-delay:0.18s]" />
        <span className="assistant-thinking-dot inline-block size-[3px] rounded-full bg-current [animation-delay:0.36s]" />
      </span>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  suggestedActions,
  isTransitional,
  onPickSuggestedMessage,
  compact,
}: ChatMessage & {
  onPickSuggestedMessage?: (text: string) => void;
  /** Drawer / narrow column: full width + tighter typography. */
  compact?: boolean;
}) {
  const isUser = role === "user";
  const bubbleText = cn(
    "whitespace-pre-wrap [word-break:normal] break-words [overflow-wrap:anywhere]",
    role === "assistant"
      ? "text-base font-normal leading-relaxed text-foreground"
      : "text-[0.9375rem] font-normal leading-[1.65] text-foreground",
  );
  if (role === "assistant") {
    const parsed = parseLeadQualifyEmbed(content);
    if (parsed) {
      return (
        <div className="flex w-full min-w-0 justify-start">
          <div
            className={cn(
              "min-w-0 rounded-xl border border-border bg-muted/50 px-4 py-3.5 font-headline shadow-none dark:bg-[#111]/80",
              compact ? "w-full max-w-full" : "max-w-[min(100%,40rem)]",
            )}
          >
            <p className={bubbleText}>{parsed.introText}</p>
            <LeadQualifyPanel payload={parsed.payload} />
          </div>
        </div>
      );
    }
  }
  const { cleanText, actions: navActions } = role === "assistant"
    ? parseActionTags(content)
    : { cleanText: content, actions: [] as ActionTag[] };

  return (
    <div className={cn("flex w-full min-w-0", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "min-w-0 rounded-2xl px-3 py-2.5 font-headline shadow-none sm:px-4 sm:py-3",
          compact ? "w-full max-w-full" : "max-w-[min(100%,40rem)]",
          isUser
            ? "border border-secondary/35 bg-secondary/10 text-foreground dark:border-[#BD9952]/22 dark:bg-[#1a1610] dark:text-slate-100"
            : "border border-border bg-muted/40 dark:bg-[#111]/90",
          isTransitional && !isUser && "animate-pulse border-secondary/25 opacity-70 dark:border-[#BD9952]/15",
        )}
      >
        <p className={bubbleText}>{cleanText}</p>
        {role === "assistant" && suggestedActions && suggestedActions.length > 0 && onPickSuggestedMessage ? (
          <SuggestedActionChips actions={suggestedActions} onMessagePick={onPickSuggestedMessage} />
        ) : null}
        {role === "assistant" ? <NavigationButtons actions={navActions} /> : null}
      </div>
    </div>
  );
}

type AssistantStreamState =
  | { kind: "idle" }
  | { kind: "thinking" }
  | { kind: "streaming"; text: string };

function isAffirmingPendingAction(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t === "y") return true;
  return /^(yes|yep|yeah|yup|sure|ok|okay|confirm|confirmed|do\s+it|go\s+ahead|proceed|please\s+do)\b/.test(
    t,
  );
}

function isPendingCEOActionClient(value: unknown): value is PendingCEOAction {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  if (o.v !== 1) return false;
  if (!Array.isArray(o.toolCalls)) return false;
  return o.toolCalls.every((c) => {
    if (typeof c !== "object" || c === null) return false;
    const row = c as Record<string, unknown>;
    return typeof row.name === "string" && typeof row.input === "object" && row.input !== null;
  });
}

async function postChatRequest(
  conversationId: string,
  messages: ChatMessage[],
  options?: {
    confirmedExecution?: boolean;
    pendingAction?: PendingCEOAction | null;
  },
): Promise<
  | { kind: "stream"; consume: (onDelta: (chunk: string) => void) => Promise<void> }
  | { kind: "clarification"; message: string }
  | { kind: "confirmation"; message: string; pendingAction: PendingCEOAction }
  | { kind: "lead_qualify"; message: string }
  | { kind: "suggested_actions"; message: string; suggestedActions: LetoraSuggestedAction[] }
> {
  const body: Record<string, unknown> = { conversationId, messages };
  if (options?.confirmedExecution === true && options.pendingAction) {
    body.confirmedExecution = true;
    body.pendingAction = options.pendingAction;
  }

  const res = await fetch("/api/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    if (contentType.includes("application/json")) {
      const raw: unknown = await res.json().catch(() => null);
      if (raw && typeof raw === "object" && raw !== null) {
        const err = raw as Record<string, unknown>;
        if (typeof err.error === "string") detail = err.error;
        else if (typeof err.message === "string") detail = err.message;
      }
    } else {
      const text = await res.text().catch(() => "");
      if (text) detail = text.slice(0, 200);
    }
    throw new Error(detail);
  }

  if (contentType.includes("application/json")) {
    const raw: unknown = await res.json();
    if (raw && typeof raw === "object" && raw !== null) {
      const o = raw as Record<string, unknown>;
      if (o.needsClarification === true && typeof o.message === "string") {
        return { kind: "clarification", message: o.message };
      }
      if (
        o.needsConfirmation === true &&
        typeof o.message === "string" &&
        isPendingCEOActionClient(o.pendingAction)
      ) {
        return {
          kind: "confirmation",
          message: o.message,
          pendingAction: o.pendingAction,
        };
      }
      if (o.needsLeadQualifyPrompt === true && typeof o.message === "string") {
        return { kind: "lead_qualify", message: o.message };
      }
      if (
        typeof o.message === "string" &&
        Array.isArray(o.suggestedActions) &&
        o.suggestedActions.length > 0
      ) {
        return {
          kind: "suggested_actions",
          message: o.message,
          suggestedActions: o.suggestedActions as LetoraSuggestedAction[],
        };
      }
    }
    throw new Error("Unexpected response from assistant.");
  }

  if (!res.body) {
    throw new Error("No response body.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  return {
    kind: "stream",
    consume: async (onDelta: (chunk: string) => void) => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            if (chunk) onDelta(chunk);
          }
          if (done) {
            const final = decoder.decode();
            if (final) onDelta(final);
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

export function AssistantChat({
  conversations,
  activeConversationId,
  initialMessages,
  initialPromptToSend,
}: {
  conversations: AssistantConversationListItem[];
  activeConversationId: string;
  initialMessages: ChatMessage[];
  /** First message to send automatically (e.g. from home handoff). Only used when the thread is empty. */
  initialPromptToSend?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistantStream, setAssistantStream] = useState<AssistantStreamState>({
    kind: "idle",
  });
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingCEOAction | null>(() =>
    getPendingCeoActionFromMessages(initialMessages),
  );
  const [conversationListOpen, setConversationListOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const starterFiredRef = useRef(false);

  useEffect(() => {
    const next = initialMessages.map((m) => ({
      role: m.role,
      content: m.content,
      suggestedActions: m.suggestedActions,
      pendingCeoAction: m.pendingCeoAction,
    }));
    setMessages(next);
    setPendingAction(getPendingCeoActionFromMessages(next));
  }, [activeConversationId, initialMessages]);

  const scrollToLatest = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToLatest();
  }, [messages, loading, assistantStream, scrollToLatest]);

  function createNewChat() {
    setConversationListOpen(false);
    router.push("/dashboard");
  }

  type ProcessedChatResult = {
    kind: string;
    replyText: string;
    message: ChatMessage;
    /** True when the chain must stop (confirmation needs user input, lead qualify has interactive UI). */
    stopChain: boolean;
  };

  async function processChatResult(
    result: Awaited<ReturnType<typeof postChatRequest>>,
  ): Promise<ProcessedChatResult> {
    switch (result.kind) {
      case "clarification":
        return {
          kind: result.kind,
          replyText: result.message,
          message: { role: "assistant", content: result.message },
          stopChain: false,
        };
      case "lead_qualify":
        return {
          kind: result.kind,
          replyText: result.message,
          message: { role: "assistant", content: result.message },
          stopChain: true,
        };
      case "confirmation":
        setPendingAction(result.pendingAction);
        return {
          kind: result.kind,
          replyText: result.message,
          message: {
            role: "assistant",
            content: result.message,
            pendingCeoAction: result.pendingAction,
          },
          stopChain: true,
        };
      case "suggested_actions":
        return {
          kind: result.kind,
          replyText: result.message,
          message: {
            role: "assistant",
            content: result.message,
            suggestedActions: result.suggestedActions,
          },
          stopChain: false,
        };
      case "stream": {
        let text = "";
        await result.consume((chunk) => {
          text += chunk;
          setAssistantStream({ kind: "streaming", text });
        });
        return {
          kind: result.kind,
          replyText: text,
          message: { role: "assistant", content: text },
          stopChain: false,
        };
      }
    }
  }

  function markLastAssistantAsTransitional(thread: ChatMessage[]): ChatMessage[] {
    const updated = [...thread];
    for (let i = updated.length - 1; i >= 0; i--) {
      if (updated[i].role === "assistant") {
        updated[i] = { ...updated[i], isTransitional: true };
        break;
      }
    }
    return updated;
  }

  async function sendMessage(overrideText?: string) {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || loading) return;

    if (overrideText !== undefined) {
      router.replace(`/dashboard?c=${activeConversationId}`, { scroll: false });
    }

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    let currentThread: ChatMessage[] = [...messages, userMessage];
    setMessages(currentThread);
    setInput("");
    setError(null);
    setLoading(true);
    setAssistantStream({ kind: "thinking" });

    let confirmedExecution = false;
    let actionPayload: PendingCEOAction | null = null;

    if (pendingAction) {
      if (isAffirmingPendingAction(trimmed)) {
        confirmedExecution = true;
        actionPayload = pendingAction;
      } else {
        setPendingAction(null);
      }
    }

    try {
      const result = await postChatRequest(activeConversationId, currentThread, {
        confirmedExecution,
        pendingAction: actionPayload,
      });

      const processed = await processChatResult(result);
      currentThread = [...currentThread, processed.message];
      setMessages([...currentThread]);

      if (confirmedExecution && processed.kind === "stream") {
        setPendingAction(null);
      }

      let followUpCount = 0;
      let lastReplyText = processed.replyText;
      let chainStopped = processed.stopChain;

      while (
        !chainStopped &&
        isAutonomousContinuationSignal(lastReplyText) &&
        followUpCount < MAX_AUTONOMOUS_FOLLOWUPS
      ) {
        followUpCount++;
        currentThread = markLastAssistantAsTransitional(currentThread);
        setMessages([...currentThread]);

        await autonomousDelay(AUTONOMOUS_FOLLOWUP_DELAY_MS);
        setAssistantStream({ kind: "thinking" });

        try {
          const followUp = await postChatRequest(activeConversationId, currentThread);
          const followUpProcessed = await processChatResult(followUp);
          currentThread = [...currentThread, followUpProcessed.message];
          setMessages([...currentThread]);
          lastReplyText = followUpProcessed.replyText;
          chainStopped = followUpProcessed.stopChain;
        } catch {
          currentThread = [
            ...currentThread,
            { role: "assistant", content: "Something went wrong fetching that. Please try again." },
          ];
          setMessages([...currentThread]);
          break;
        }
      }

      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
      setAssistantStream({ kind: "idle" });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    e.currentTarget.blur();
    void sendMessage();
  }

  useEffect(() => {
    if (!initialPromptToSend?.trim()) return;
    if (starterFiredRef.current) return;
    if (messages.length > 0) return;
    starterFiredRef.current = true;
    void sendMessage(initialPromptToSend);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot bootstrap from landing page
  }, [initialPromptToSend, activeConversationId, messages.length]);

  const canSend = input.trim().length > 0 && !loading;

  const showEmptyPlaceholder =
    messages.length === 0 && !loading && assistantStream.kind === "idle";

  const assistantWaitingForToken =
    assistantStream.kind === "thinking" ||
    (assistantStream.kind === "streaming" && assistantStream.text.length === 0);
  const assistantStreamVisible =
    assistantStream.kind === "streaming" && assistantStream.text.length > 0;
  const showAssistantStreamSection =
    assistantStream.kind === "thinking" || assistantStream.kind === "streaming";

  const sidebar = (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-border bg-sidebar/30 dark:bg-[#0a0a0a]/80">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 rounded-full border-border bg-transparent font-headline text-xs font-medium text-foreground transition-colors duration-200 ease-out hover:bg-muted/90 dark:hover:bg-sidebar-accent"
          onClick={() => createNewChat()}
        >
          <MessageSquarePlus className="mr-1.5 size-3.5" aria-hidden />
          New chat
        </Button>
      </div>
      <AssistantConversationList
        className="min-h-0 flex-1 px-1"
        conversations={conversations}
        activeConversationId={activeConversationId}
        variant="sidebar"
      />
    </div>
  );

  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col border-b border-border bg-background/90 px-5 py-4 lg:px-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-headline text-[0.9375rem] font-medium tracking-[-0.02em] text-foreground">
              Assistant
            </h1>
            <p className="mt-0.5 font-headline text-[0.75rem] font-normal text-muted-foreground">
              Rent · maintenance · tenants · contracts · leads
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <Sheet open={conversationListOpen} onOpenChange={setConversationListOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full border-border bg-muted"
                  aria-label="Open conversations"
                >
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-[min(100%,20rem)] flex-col gap-0 border-border bg-background p-0"
              >
                <SheetHeader className="border-b border-border px-4 py-3 text-left">
                  <SheetTitle className="font-headline text-sm font-medium text-foreground">
                    Chats
                  </SheetTitle>
                </SheetHeader>
                {sidebar}
              </SheetContent>
            </Sheet>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full border-border bg-muted"
              onClick={() => createNewChat()}
              aria-label="New chat"
            >
              <MessageSquarePlus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[17rem] shrink-0 border-r border-border bg-sidebar/20 dark:bg-[#0a0a0a]/50 md:flex md:flex-col">
          {sidebar}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-5 py-6 lg:px-10 lg:py-8">
              {showEmptyPlaceholder ? (
                <div className="mx-auto max-w-xl text-center">
                  <p className="font-headline text-sm font-light text-muted-foreground">
                    Describe a task in plain English. Mention a tenant, property, or street when it helps.
                  </p>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-6">
                  {messages.map((m, i) => (
                    <MessageBubble
                      key={`${m.role}-${i}-${m.content.slice(0, 24)}`}
                      role={m.role}
                      content={m.content}
                      suggestedActions={m.suggestedActions}
                      isTransitional={m.isTransitional}
                      onPickSuggestedMessage={(text) => setInput(text)}
                    />
                  ))}
                  {showAssistantStreamSection ? (
                    <div className="flex w-full min-w-0 flex-col gap-0">
                      <div
                        className={cn(
                          "overflow-hidden transition-[opacity,max-height] duration-300 ease-out",
                          assistantWaitingForToken
                            ? "pointer-events-auto max-h-10 opacity-100"
                            : "pointer-events-none max-h-0 opacity-0",
                        )}
                      >
                        <AssistantThinkingIndicator />
                      </div>
                      {assistantStreamVisible ? (
                        <div className="assistant-reply-enter">
                          <MessageBubble role="assistant" content={assistantStream.text} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {error ? (
              <div className="shrink-0 border-t border-red-500/20 bg-red-950/30 px-5 py-2.5 font-headline text-sm text-red-400/95 lg:px-8">
                {error}
              </div>
            ) : null}

            <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 sm:px-5 sm:py-4 lg:px-8 lg:py-5 dark:bg-[#0a0a0a]/95">
              <form
                className="mx-auto flex w-full max-w-[40rem] flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
              >
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Write a message…"
                  rows={2}
                  disabled={loading}
                  className="min-h-[48px] min-w-0 flex-1 resize-none rounded-xl border border-border bg-muted/50 px-4 py-3 font-headline text-[0.9375rem] font-light leading-[1.5] text-foreground placeholder:text-placeholder-foreground transition-[color,background-color,border-color,box-shadow] duration-200 ease-out focus-visible:border-ring focus-visible:ring-0 sm:min-h-[52px] dark:bg-[#121212]"
                  aria-label="Message"
                />
                <Button
                  type="submit"
                  disabled={!canSend}
                  className="h-11 shrink-0 rounded-full bg-[#BD9952] px-6 font-headline text-xs font-semibold uppercase tracking-[0.12em] text-[#1f1608] transition-colors duration-200 ease-out hover:bg-[#c4a45e] sm:h-12 sm:min-w-[7rem]"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <>
                      <Send className="size-3.5" aria-hidden />
                      <span className="sr-only sm:not-sr-only sm:ml-2">Send</span>
                    </>
                  )}
                </Button>
              </form>
              <p className="mx-auto mt-3 hidden max-w-[40rem] font-headline text-[0.65rem] text-muted-foreground md:block">
                Enter to send · Shift+Enter for a new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
