"use client";

import { Loader2, Menu, MessageSquarePlus, PanelLeft, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantConversationListItem } from "@/lib/assistant-messages/store";
import {
  parseLeadQualifyEmbed,
  type LeadQualifyEmbedPayloadV1,
} from "@/lib/assistant/lead-qualify-embed";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Mirrors server `PendingCEOAction` for in-memory session only (re-sent on confirm). */
type PendingCEOActionClient = {
  v: 1;
  toolCalls: { name: string; input: Record<string, string> }[];
};

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

function MessageBubble({ role, content }: ChatMessage) {
  const isUser = role === "user";
  if (role === "assistant") {
    const parsed = parseLeadQualifyEmbed(content);
    if (parsed) {
      return (
        <div className="flex w-full justify-start">
          <div className="max-w-[min(100%,42rem)] rounded-xl border border-border bg-muted/60 px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-sm dark:bg-muted/40">
            <p className="whitespace-pre-wrap break-words">{parsed.introText}</p>
            <LeadQualifyPanel payload={parsed.payload} />
          </div>
        </div>
      );
    }
  }
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(100%,42rem)] rounded-xl border px-3 py-2.5 text-sm leading-relaxed shadow-sm",
          isUser
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-border bg-muted/60 text-foreground dark:bg-muted/40",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
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

function isPendingCEOActionClient(value: unknown): value is PendingCEOActionClient {
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
    pendingAction?: PendingCEOActionClient | null;
  },
): Promise<
  | { kind: "stream"; consume: (onDelta: (chunk: string) => void) => Promise<void> }
  | { kind: "clarification"; message: string }
  | { kind: "confirmation"; message: string; pendingAction: PendingCEOActionClient }
  | { kind: "lead_qualify"; message: string }
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

function ConversationListPanel({
  conversations,
  activeConversationId,
}: {
  conversations: AssistantConversationListItem[];
  activeConversationId: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
      {conversations.map((c) => {
        const active = c.id === activeConversationId;
        return (
          <Link
            key={c.id}
            href={`/dashboard/assistant?c=${c.id}`}
            scroll={false}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span className="line-clamp-2">{c.title || "New chat"}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AssistantChat({
  conversations,
  activeConversationId,
  initialMessages,
}: {
  conversations: AssistantConversationListItem[];
  activeConversationId: string;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistantStream, setAssistantStream] = useState<AssistantStreamState>({
    kind: "idle",
  });
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingCEOActionClient | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [activeConversationId, initialMessages]);

  const scrollToLatest = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToLatest();
  }, [messages, loading, assistantStream, scrollToLatest]);

  async function createNewChat() {
    setMobileOpen(false);
    setError(null);
    try {
      const res = await fetch("/api/assistant/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Could not start a new chat.");
      }
      const data = (await res.json()) as { id: string };
      router.push(`/dashboard/assistant?c=${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a new chat.");
    }
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextThread: ChatMessage[] = [...messages, userMessage];
    setMessages(nextThread);
    setInput("");
    setError(null);
    setLoading(true);
    setAssistantStream({ kind: "thinking" });

    let confirmedExecution = false;
    let actionPayload: PendingCEOActionClient | null = null;

    if (pendingAction) {
      if (isAffirmingPendingAction(trimmed)) {
        confirmedExecution = true;
        actionPayload = pendingAction;
      } else {
        setPendingAction(null);
      }
    }

    let accumulated = "";

    try {
      const result = await postChatRequest(activeConversationId, nextThread, {
        confirmedExecution,
        pendingAction: actionPayload,
      });

      if (result.kind === "clarification") {
        setMessages((prev) => [...prev, { role: "assistant", content: result.message }]);
        router.refresh();
        return;
      }

      if (result.kind === "lead_qualify") {
        setMessages((prev) => [...prev, { role: "assistant", content: result.message }]);
        router.refresh();
        return;
      }

      if (result.kind === "confirmation") {
        setPendingAction(result.pendingAction);
        setMessages((prev) => [...prev, { role: "assistant", content: result.message }]);
        router.refresh();
        return;
      }

      await result.consume((chunk) => {
        accumulated += chunk;
        setAssistantStream({ kind: "streaming", text: accumulated });
      });

      setMessages((prev) => [...prev, { role: "assistant", content: accumulated }]);

      if (confirmedExecution) {
        setPendingAction(null);
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

  const canSend = input.trim().length > 0 && !loading;

  const showEmptyPlaceholder =
    messages.length === 0 && !loading && assistantStream.kind === "idle";

  const sidebar = (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-border bg-muted/20">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => void createNewChat()}>
          <MessageSquarePlus className="mr-1 size-4" aria-hidden />
          New chat
        </Button>
      </div>
      <ConversationListPanel conversations={conversations} activeConversationId={activeConversationId} />
    </div>
  );

  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-1 border-b border-border px-4 py-4 lg:px-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold tracking-tight">Letora Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Ask about rent, maintenance, tenants, contracts, or leads.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label="Open conversations">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[min(100%,20rem)] flex-col p-0">
                <SheetHeader className="border-b border-border px-4 py-3 text-left">
                  <SheetTitle className="text-base">Conversations</SheetTitle>
                </SheetHeader>
                {sidebar}
              </SheetContent>
            </Sheet>
            <Button type="button" variant="outline" size="icon" onClick={() => void createNewChat()} aria-label="New chat">
              <MessageSquarePlus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-muted/15 md:flex md:flex-col">{sidebar}</aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="hidden border-b border-border px-4 py-2 text-xs text-muted-foreground md:block lg:px-6">
            <span className="inline-flex items-center gap-1">
              <PanelLeft className="size-3.5 opacity-70" aria-hidden />
              Conversations on the left — or use the menu on mobile.
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
              {showEmptyPlaceholder ? (
                <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground dark:bg-muted/20">
                  <p className="font-medium text-foreground">Start a conversation</p>
                  <p className="mt-2 leading-relaxed">
                    Your assistant can help with property-related tasks — rent chasing, maintenance,
                    tenants, contracts, and leads. Describe what you need in plain English.
                  </p>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                  {messages.map((m, i) => (
                    <MessageBubble key={`${m.role}-${i}-${m.content.slice(0, 24)}`} {...m} />
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

            <div className="shrink-0 border-t border-border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
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
                  className="min-h-[44px] flex-1 resize-none sm:min-h-[52px]"
                  aria-label="Message"
                />
                <Button
                  type="submit"
                  disabled={!canSend}
                  className="h-11 shrink-0 sm:h-auto sm:min-h-[52px] sm:px-6"
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
