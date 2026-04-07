"use client";

import { Loader2, Menu, MessageSquarePlus, PanelLeft, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { getPendingCeoActionFromMessages } from "@/lib/assistant/pending-ceo-from-messages";
import { AssistantConversationList } from "@/components/dashboard/assistant-conversation-list";
import type { AssistantConversationListItem } from "@/lib/assistant-messages/store";
import type { PendingCEOAction } from "@/lib/agents/ceo/safety";
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
  /** UI-only flag — marks "please wait" messages with transitional styling. */
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
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">Manual qualification</p>
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
              className="rounded-lg border border-border bg-background/60 p-3 text-left dark:bg-background/40"
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
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Suggested actions">
      {actions.map((a) => (
        <Button
          key={a.id}
          type="button"
          size="sm"
          variant="secondary"
          className="h-auto min-h-8 max-w-full whitespace-normal text-left text-xs"
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

const ACTION_TAG_REGEX = /<action\s+type="navigate"\s+label="([^"]+)"\s+href="([^"]+)"\s*\/>/g;

const CONTRACT_ID_PATTERN =
  /(?:contract\s*(?:id|ID)[:\s]+|\/dashboard\/contracts\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function parseActionTags(text: string): { cleanText: string; actions: ActionTag[] } {
  const actions: ActionTag[] = [];
  const cleanText = text.replace(ACTION_TAG_REGEX, (_match, label: string, href: string) => {
    actions.push({ label, href });
    return "";
  }).trim();

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
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {a.label}
          <span aria-hidden>→</span>
        </Link>
      ))}
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
    "whitespace-pre-wrap text-sm leading-relaxed [word-break:normal]",
    "break-words [overflow-wrap:anywhere]",
  );
  if (role === "assistant") {
    const parsed = parseLeadQualifyEmbed(content);
    if (parsed) {
      return (
        <div className="flex w-full min-w-0 justify-start">
          <div
            className={cn(
              "min-w-0 rounded-xl border border-border bg-muted/60 px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-sm dark:bg-muted/40",
              compact ? "w-full max-w-full" : "max-w-[min(100%,42rem)]",
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
          "min-w-0 rounded-xl border px-3 py-2.5 text-sm leading-relaxed shadow-sm",
          compact ? "w-full max-w-full" : "max-w-[min(100%,42rem)]",
          isUser
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-border bg-muted/60 text-foreground dark:bg-muted/40",
          isTransitional && !isUser && "animate-pulse border-primary/30 opacity-60",
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
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

  const sidebar = (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-[#484848]/20 bg-[#0E0E0E]/40 backdrop-blur-sm">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#484848]/20 p-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 border-[#484848]/35 bg-[#131313]/60 text-[#E7E5E4] hover:bg-[#1F2020]"
          onClick={() => createNewChat()}
        >
          <MessageSquarePlus className="mr-1 size-4" aria-hidden />
          New chat
        </Button>
      </div>
      <AssistantConversationList
        className="min-h-0 flex-1"
        conversations={conversations}
        activeConversationId={activeConversationId}
        variant="sidebar"
      />
    </div>
  );

  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-1 border-b border-[#484848]/25 bg-[#0E0E0E]/30 px-4 py-4 backdrop-blur-sm lg:px-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-headline text-base font-medium tracking-tight text-[#E7E5E4]">
              Letora Assistant
            </h1>
            <p className="font-[family-name:var(--font-inter)] text-sm text-[#ACABAA]">
              Rent, maintenance, tenants, agreements, or leads.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <Sheet open={conversationListOpen} onOpenChange={setConversationListOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-[#484848]/35 bg-[#131313]/70"
                  aria-label="Open conversations"
                >
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-[min(100%,20rem)] flex-col gap-0 border-[#484848]/25 bg-[#0E0E0E]/95 p-0 backdrop-blur-xl"
              >
                <SheetHeader className="border-b border-[#484848]/20 px-4 py-3 text-left">
                  <SheetTitle className="font-headline text-base text-[#E7E5E4]">Conversations</SheetTitle>
                </SheetHeader>
                {sidebar}
              </SheetContent>
            </Sheet>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-[#484848]/35 bg-[#131313]/70"
              onClick={() => createNewChat()}
              aria-label="New chat"
            >
              <MessageSquarePlus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-[#484848]/20 bg-[#0E0E0E]/35 backdrop-blur-sm md:flex md:flex-col">
          {sidebar}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="hidden border-b border-[#484848]/20 px-4 py-2 font-[family-name:var(--font-inter)] text-xs text-[#ACABAA] md:block lg:px-6">
            <span className="inline-flex items-center gap-1">
              <PanelLeft className="size-3.5 opacity-70" aria-hidden />
              Chat history on the left — menu on mobile.
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
              {showEmptyPlaceholder ? (
                <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-[#484848]/35 bg-[#131313]/30 p-6 text-center text-sm text-[#ACABAA] backdrop-blur-sm">
                  <p className="font-headline font-medium text-[#E7E5E4]">Start a conversation</p>
                  <p className="mt-2 leading-relaxed">
                    Your assistant can help with property-related tasks — rent chasing, maintenance,
                    tenants, tenancy agreements, and leads. Describe what you need in plain English.
                  </p>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
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
                  {assistantStream.kind === "thinking" ? (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground dark:bg-muted/40">
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        <span>Thinking…</span>
                      </div>
                    </div>
                  ) : null}
                  {assistantStream.kind === "streaming" ? (
                    <MessageBubble role="assistant" content={assistantStream.text} />
                  ) : null}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {error ? (
              <div className="shrink-0 border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive lg:px-6">
                {error}
              </div>
            ) : null}

            <div className="shrink-0 border-t border-[#484848]/25 bg-[#0E0E0E]/75 p-4 backdrop-blur-md supports-[backdrop-filter]:bg-[#0E0E0E]/60 lg:px-6">
              <form
                className="mx-auto flex w-full max-w-3xl flex-col gap-2 sm:flex-row sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
              >
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Message Letora Assistant…"
                  rows={2}
                  disabled={loading}
                  className="min-h-[44px] min-w-0 flex-1 resize-none border-[#484848]/30 bg-[#131313]/50 text-[#E7E5E4] placeholder:text-[#484848] sm:min-h-[52px]"
                  aria-label="Message"
                />
                <Button
                  type="submit"
                  disabled={!canSend}
                  className="h-11 shrink-0 bg-[#BD9952] text-[#2c1e00] hover:bg-[#c9a660] sm:h-auto sm:min-h-[52px] sm:px-6"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <>
                      <Send className="size-4" aria-hidden />
                      <span className="sr-only sm:not-sr-only sm:ml-1.5">Send</span>
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
