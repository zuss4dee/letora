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
    // Fixed locale so SSR and browser match (undefined uses Node vs browser defaults).
    return new Intl.DateTimeFormat("en-GB", {
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
  /** Path prefix for thread links (default: Command Center `/dashboard?c=`). */
  hrefBase = "/dashboard",
}: {
  conversations: AssistantConversationListItem[];
  activeConversationId?: string;
  variant?: "sidebar" | "inline";
  className?: string;
  hrefBase?: string;
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
            href={`${hrefBase}?c=${encodeURIComponent(c.id)}`}
            scroll={false}
            className={cn(
              "block min-w-0 rounded-lg px-3 py-2.5 text-left font-headline text-[0.8125rem] font-normal leading-snug transition-colors duration-200 ease-out",
              variant === "sidebar" &&
                (active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted/90 hover:text-foreground dark:hover:bg-sidebar-accent/70"),
              variant === "inline" &&
                (active
                  ? "border border-secondary/30 bg-secondary/10 font-medium text-foreground"
                  : "border border-transparent text-muted-foreground transition-colors duration-200 ease-out hover:border-border hover:bg-muted hover:text-foreground"),
            )}
          >
            <span
              className={cn(
                "block min-w-0 truncate",
                variant === "inline" && "font-headline",
              )}
              title={c.title || "New chat"}
            >
              {c.title || "New chat"}
            </span>
            {variant === "inline" ? (
              <span className="mt-1 block font-headline text-[0.6rem] uppercase tracking-[0.08em] text-muted-foreground">
                {formatChatTimestamp(c.updated_at)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
