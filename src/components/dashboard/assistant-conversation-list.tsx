"use client";

import Link from "next/link";

import type { AssistantConversationListItem } from "@/lib/assistant-messages/store";
import { cn } from "@/lib/utils";

function formatChatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const absMin = Math.abs(Math.round(diffMs / 60000));
    if (absMin < 1) return "Just now";
    if (absMin < 60) return diffMs >= 0 ? `${absMin}m ago` : `in ${absMin}m`;
    const absH = Math.round(absMin / 60);
    if (absH < 24) return diffMs >= 0 ? `${absH}h ago` : `in ${absH}h`;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    }).format(d);
  } catch {
    return "";
  }
}

/**
 * Shared thread list for the assistant: sidebar in `AssistantChat` and “recent chats” on the landing view.
 */
export function AssistantConversationList({
  conversations,
  activeConversationId,
  variant = "sidebar",
  className,
}: {
  conversations: AssistantConversationListItem[];
  activeConversationId?: string;
  variant?: "sidebar" | "inline";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-1 overflow-y-auto p-2",
        variant === "inline" && "p-1",
        className,
      )}
    >
      {conversations.map((c) => {
        const active = activeConversationId != null && c.id === activeConversationId;
        return (
          <Link
            key={c.id}
            href={`/dashboard?c=${c.id}`}
            scroll={false}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-sm transition-colors",
              variant === "sidebar" &&
                (active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"),
              variant === "inline" &&
                (active
                  ? "border border-[#BD9952]/35 bg-[#BD9952]/10 font-medium text-[#E7E5E4]"
                  : "border border-transparent text-[#ACABAA] hover:border-[#484848]/40 hover:bg-[#1a1a1a] hover:text-[#E7E5E4]"),
            )}
          >
            <span className={cn("line-clamp-2 block", variant === "inline" && "font-headline")}>
              {c.title || "New chat"}
            </span>
            {variant === "inline" ? (
              <span className="mt-0.5 block font-[family-name:var(--font-inter)] text-[0.65rem] text-[#6b6a69]">
                {formatChatTimestamp(c.updated_at)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
