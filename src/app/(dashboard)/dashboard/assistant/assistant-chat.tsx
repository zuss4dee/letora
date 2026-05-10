"use client";

/* eslint-disable @typescript-eslint/no-unused-vars, @next/next/no-img-element -- legacy assistant embeds + avatar; prune separately */

import {
  ArrowUpRight,
  ClipboardCheck,
  FileCheck2,
  Home,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getPendingCeoActionFromMessages } from "@/lib/assistant/pending-ceo-from-messages";
import type { AssistantConversationListItem } from "@/lib/assistant-messages/store";
import { stripNavigateActionTagsFromAssistantText, type PendingCEOAction } from "@/lib/agents/ceo/safety";
import type { LetoraSuggestedAction } from "@/lib/agents/ceo/suggested-actions";
import type { LeadQualifyEmbedPayloadV1 } from "@/lib/assistant/lead-qualify-embed";
import { cn } from "@/lib/utils";
import {
  autonomousDelay,
  AUTONOMOUS_FOLLOWUP_DELAY_MS,
  isAutonomousContinuationSignal,
  MAX_AUTONOMOUS_FOLLOWUPS,
} from "./autonomous-continuation";

/** Canonical assistant/chat URL (Command Center hub). */
const ASSISTANT_CHAT_HREF_BASE = "/dashboard";

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
  onPickSuggestedMessage,
}: {
  actions: LetoraSuggestedAction[];
  onPickSuggestedMessage: (text: string) => void;
}) {
  const actionable = actions.filter((a) =>
    a.kind === "link"
      ? isValidDashboardDeepLink(a.href ?? "")
      : Boolean((a.message || a.label)?.trim().length > 0),
  );
  if (actionable.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-2" role="group" aria-label="Suggested actions">
      {actionable.map((a) => {
        if (a.kind === "link" && a.href) {
          const visual = inferActionVisual(a.label, a.href);
          return (
            <Link
              key={a.id}
              href={a.href}
              className="flex items-center gap-2 border border-zinc-300 bg-transparent px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <ActionTypeIcon kind={visual.kind} />
              {a.label}
              <ArrowUpRight className="size-3" />
            </Link>
          );
        }
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onPickSuggestedMessage(a.message || a.label)}
            className="flex items-center gap-2 border border-zinc-300 bg-transparent px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <MessageSquare className="size-3" />
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

interface ActionTag {
  label: string;
  href: string;
}

type StatusChipTone = "created" | "reused" | "drafted" | "pending" | "blocked" | "sent";
type StatusChip = { label: string; tone: StatusChipTone };
type StructuredSection = { title: string; lines: string[] };
type ActionVisualKind =
  | "approvals"
  | "onboarding"
  | "tenancy"
  | "maintenance"
  | "compliance"
  | "generic";
type ActionVisual = { kind: ActionVisualKind; label: string };

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

function normalizeActionLabel(label: string): string {
  const t = label.trim();
  return t.length > 0 ? t : "Open";
}

function inferActionVisual(label: string, href?: string): ActionVisual {
  const normalizedLabel = normalizeActionLabel(label);
  const l = normalizedLabel.toLowerCase();
  const target = `${l} ${(href ?? "").toLowerCase()}`;
  if (/\bapproval/.test(target)) return { kind: "approvals", label: normalizedLabel };
  if (/\bonboard/.test(target)) return { kind: "onboarding", label: normalizedLabel };
  if (/\btenanc/.test(target)) return { kind: "tenancy", label: normalizedLabel };
  if (/\bmainten/.test(target) || /\brepair/.test(target)) {
    return { kind: "maintenance", label: normalizedLabel };
  }
  if (/\bcompliance/.test(target) || /\breferenc/.test(target)) {
    return { kind: "compliance", label: normalizedLabel };
  }
  return { kind: "generic", label: normalizedLabel };
}

function ActionTypeIcon({ kind }: { kind: ActionVisualKind }) {
  const className = "size-3.5 shrink-0 text-zinc-600 dark:text-zinc-400";
  if (kind === "approvals") return <ClipboardCheck className={className} aria-hidden />;
  if (kind === "onboarding") return <Home className={className} aria-hidden />;
  if (kind === "tenancy") return <FileCheck2 className={className} aria-hidden />;
  if (kind === "maintenance") return <Wrench className={className} aria-hidden />;
  if (kind === "compliance") return <ShieldCheck className={className} aria-hidden />;
  return <ArrowUpRight className={className} aria-hidden />;
}

function extractStatusChips(text: string): StatusChip[] {
  const normalized = text.toLowerCase();
  const out: StatusChip[] = [];
  if (/\bcreated\b/.test(normalized)) out.push({ label: "Created", tone: "created" });
  if (/\breused\b/.test(normalized)) out.push({ label: "Reused", tone: "reused" });
  if (/\bdrafted\b/.test(normalized)) out.push({ label: "Drafted", tone: "drafted" });
  if (/\bpending approval\b/.test(normalized)) out.push({ label: "Pending approval", tone: "pending" });
  if (/\bblocked\b/.test(normalized)) out.push({ label: "Blocked", tone: "blocked" });
  if (/\bsent\b/.test(normalized)) out.push({ label: "Sent", tone: "sent" });
  return out;
}

const STRUCTURED_TITLES = [
  "Top priority",
  "Why",
  "Affected items",
  "Blocker",
  "Pattern to watch",
  "Next action",
  "Current stage",
  "Completed steps",
  "Pending tasks",
] as const;

function parseStructuredSections(text: string): { intro: string; sections: StructuredSection[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections: StructuredSection[] = [];
  const intro: string[] = [];
  let current: StructuredSection | null = null;

  const titleRegex = new RegExp(
    `^(?:[-•]\\s*)?(?:\\*\\*)?(${STRUCTURED_TITLES.map((t) => t.replace(/\s+/g, "\\s+")).join("|")})(?:\\*\\*)?\\s*[:\\-]?\\s*(.*)$`,
    "i",
  );

  for (const line of lines) {
    const m = titleRegex.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1], lines: [] };
      const tail = (m[2] ?? "").trim();
      if (tail) current.lines.push(tail);
      continue;
    }
    if (current) current.lines.push(line);
    else intro.push(line);
  }

  if (current) sections.push(current);
  return { intro: intro.join("\n"), sections };
}

function StatusChipsRow({ chips }: { chips: StatusChip[] }) {
  if (chips.length === 0) return null;
  const toneClass: Record<StatusChipTone, string> = {
    created:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    reused: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-300",
    drafted: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-300",
    pending:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    blocked: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
    sent: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  };

  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2" aria-label="Assistant status states">
      {chips.map((c) => (
        <span
          key={`${c.tone}-${c.label}`}
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 font-headline text-[0.62rem] tracking-[0.08em] uppercase sm:text-[0.65rem]",
            toneClass[c.tone],
          )}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

function StructuredSections({ sections }: { sections: StructuredSection[] }) {
  if (sections.length === 0) return null;

  return (
    <div className="grid gap-1.5 sm:gap-2">
      {sections.map((s) => (
        <div key={s.title} className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
          <p className="font-headline text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
            {s.title}
          </p>
          <div className="mt-1 space-y-1">
            {s.lines.map((line, idx) => (
              <p key={`${s.title}-${idx}`} className="text-[0.84rem] leading-relaxed text-foreground sm:text-sm">
                {line}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
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
  const valid = actions.filter((a) => isValidDashboardDeepLink(a.href));
  if (valid.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {valid.map((a, idx) => {
        const visual = inferActionVisual(a.label, a.href);
        return (
          <Link
            key={`${idx}:${a.href}:${a.label}`}
            href={a.href}
            className="flex items-center gap-2 border border-zinc-300 bg-transparent px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <ActionTypeIcon kind={visual.kind} />
            {a.label}
            <ArrowUpRight className="size-3" />
          </Link>
        );
      })}
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
}: ChatMessage & {
  onPickSuggestedMessage?: (text: string) => void;
}) {
  const isUser = role === "user";

  return (
    <div className="flex items-start gap-4">
      {/* Avatar */}
      <div className={cn(
        "size-8 shrink-0 rounded-sm overflow-hidden flex items-center justify-center",
        isUser ? "bg-zinc-200 dark:bg-zinc-800" : "bg-white text-[#0B0B0B]"
      )}>
        {isUser ? (
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvWyXI2Rsfk9_7tX8PD1vxRWWrYdFQPDu0lnFR45WhQibM2uE58c_cqsz0Una7tS-uNyHYaq3KIKXBPgXGwIxf1q0WJFL5RccJKVEqnVKeVINAMrmrS8nQNaPgGtwUY5_PGGp7JvUs1z0_mWt3KaJ55iNvMtPH_aY3nV6Of2XO0U-PTkT4E2Zvj_BxO9dPTQhEQ4JHzXWu9RTxPUukxPZKjIDZ_p2dblKs2oZpkZfWmpE7qquFsWTlK5q-s_8DXB1OFw_J7eWUFgP2"
            alt="User"
            className="size-full object-cover"
          />
        ) : (
          <Sparkles className="size-4" fill="currentColor" />
        )}
      </div>

      <div className="flex-1 pt-1 min-w-0">
        <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
          <span>{isUser ? "User" : "Letora Assistant"}</span>
          <span>/</span>
          <span>{isTransitional ? "Thinking..." : "Now"}</span>
        </div>

        {/* Message Content */}
        <div className={cn(
          "max-w-2xl border transition-opacity",
          isUser
            ? "border-zinc-200 bg-white p-4 text-[13px] text-zinc-900 dark:border-[#282828] dark:bg-[#161616] dark:text-zinc-100"
            : "border-transparent text-[13px] text-zinc-800 dark:text-zinc-300",
        )}>
          {role === "assistant" ? (
            <div className="space-y-4">
              <div className="leading-relaxed whitespace-pre-wrap [&_li]:text-zinc-700 dark:[&_li]:text-zinc-300 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-200">
                {parseActionTags(content).cleanText}
              </div>
              
              <NavigationButtons actions={parseActionTags(content).actions} />

              <SuggestedActionChips 
                actions={suggestedActions || []} 
                onPickSuggestedMessage={onPickSuggestedMessage || (() => {})} 
              />
            </div>
          ) : (
            <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
          )}
        </div>
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
  const [, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingCEOAction | null>(() =>
    getPendingCeoActionFromMessages(initialMessages),
  );
  const [, setConversationListOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior, block: "end" });
    }
  }, []);

  // Auto-scroll on new messages or stream updates
  useEffect(() => {
    // If we are actively streaming, snap instantly to avoid animation conflicts
    if (assistantStream.kind === "streaming") {
      scrollToLatest("auto");
    } else {
      scrollToLatest("smooth");
    }
  }, [messages, loading, assistantStream, scrollToLatest]);

  // Initial scroll on load
  useEffect(() => {
    scrollToLatest("auto");
  }, [activeConversationId, scrollToLatest]);

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
      router.replace(`${ASSISTANT_CHAT_HREF_BASE}?c=${activeConversationId}`, { scroll: false });
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

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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

  const assistantStreamVisible =
    assistantStream.kind === "streaming" && assistantStream.text.length > 0;
  const showAssistantStreamSection =
    assistantStream.kind === "thinking" || assistantStream.kind === "streaming";

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* ── Center: Workspace ── */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-[#0B0B0B]">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 custom-scrollbar"
        >
          <div className="mx-auto w-full max-w-4xl space-y-8">
            {showEmptyPlaceholder ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex size-12 items-center justify-center border border-zinc-200 bg-white dark:border-[#1f1f1f] dark:bg-[#0e0e0e]">
                  <Sparkles className="size-6 text-zinc-900 dark:text-white" />
                </div>
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-900 dark:text-white">
                  Letora AI Ready
                </h2>
                <p className="mt-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                  Audit properties, check compliance, or draft communications.
                </p>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <MessageBubble
                    key={`${m.role}-${i}`}
                    role={m.role}
                    content={m.content}
                    suggestedActions={m.suggestedActions}
                    isTransitional={m.isTransitional}
                    onPickSuggestedMessage={(text) => setInput(text)}
                  />
                ))}
                {showAssistantStreamSection && (
                  <div className="flex items-start gap-4">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-white text-[#0B0B0B]">
                      <Sparkles className="size-4" fill="currentColor" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                        Letora Assistant / Thinking...
                      </div>
                      <div className="max-w-2xl">
                        {assistantStreamVisible ? (
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-800 dark:text-zinc-300">
                            {assistantStream.text}
                          </p>
                        ) : (
                          <div className="flex gap-1.5 py-2">
                            <div className="size-1 animate-pulse rounded-full bg-zinc-300 dark:bg-[#333333]" />
                            <div className="size-1 animate-pulse rounded-full bg-zinc-300 dark:bg-[#333333] [animation-delay:200ms]" />
                            <div className="size-1 animate-pulse rounded-full bg-zinc-300 dark:bg-[#333333] [animation-delay:400ms]" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* ── Bottom Input ── */}
        <div className="shrink-0 border-t border-zinc-200 bg-white p-6 dark:border-[#2a2a2a] dark:bg-[#0B0B0B]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="mx-auto w-full max-w-4xl"
          >
            <div className="flex items-center border border-zinc-200 bg-white p-1.5 shadow-2xl dark:border-[#333333] dark:bg-[#1a1a1a]">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask Letora..."
                className="flex-1 bg-transparent px-4 py-3 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!canSend}
                className="flex items-center gap-2 border border-zinc-300 bg-transparent px-6 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <>
                    Send Message
                    <ArrowUpRight className="size-3.5" />
                  </>
                )}
              </button>
            </div>
            <div className="mt-3 flex justify-center border-t border-zinc-200 bg-zinc-100 px-4 py-2 dark:border-[#2a2a2a] dark:bg-[#161616]">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
                Agent LX-Core v4.2 Active
              </span>
            </div>
          </form>
        </div>
      </main>

      {/* ── Right: History Sidebar ── */}
      <aside className="relative flex h-full min-h-0 w-72 shrink-0 flex-col border-l border-zinc-200 bg-zinc-50 dark:border-[#1f1f1f] dark:bg-[#111111]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3.5 dark:border-[#1e1e1e]">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
            Active Sessions
          </span>
          <button
            type="button"
            onClick={() => createNewChat()}
            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-[#1e1e1e] dark:hover:text-white"
            title="New Session"
          >
            <MessageSquarePlus className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          <div className="flex flex-col gap-1">
            {conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <Link
                  key={conv.id}
                  href={`${ASSISTANT_CHAT_HREF_BASE}?c=${encodeURIComponent(conv.id)}`}
                  className={cn(
                    "flex w-full flex-col rounded-md border border-transparent p-3 text-left transition-colors",
                    isActive
                      ? "bg-zinc-100 dark:bg-[#1e1e1e]"
                      : "hover:bg-zinc-100 dark:hover:bg-[#1e1e1e]",
                  )}
                >
                  <div className={cn(
                    "text-[11px] font-medium leading-tight",
                    isActive ? "text-zinc-800 dark:text-zinc-300" : "text-zinc-600 dark:text-zinc-400"
                  )}>
                    {conv.title || "New session"}
                  </div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[9px] uppercase text-zinc-400 dark:text-zinc-600">
                    <span>{conv.updated_at ? new Date(conv.updated_at).toLocaleDateString() : "Now"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="border-t border-zinc-200 bg-zinc-100 p-4 dark:border-[#2a2a2a] dark:bg-[#161616]">
          <div className="flex items-center justify-between font-mono text-[9px] uppercase text-zinc-500 dark:text-zinc-500">
            <span>Shard Ops Center</span>
            <div className="size-1.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          </div>
        </div>
      </aside>
    </div>
  );
}
