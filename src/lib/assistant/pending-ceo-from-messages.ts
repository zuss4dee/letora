import type { PendingCEOAction } from "@/lib/agents/ceo/safety";

/** Client-safe: if the last message is assistant with stored pending tools, confirmation is still open. */
export function getPendingCeoActionFromMessages(
  messages: readonly {
    role: string;
    pendingCeoAction?: unknown;
    metadata?: { pendingCeoAction?: unknown } | null;
  }[],
): PendingCEOAction | null {
  if (messages.length === 0) return null;
  const last = messages[messages.length - 1];
  if (last.role !== "assistant") return null;
  const pa =
    last.pendingCeoAction !== undefined ? last.pendingCeoAction : last.metadata?.pendingCeoAction;
  if (pa == null) return null;
  if (typeof pa !== "object" || pa === null || (pa as { v?: unknown }).v !== 1) return null;
  if (!Array.isArray((pa as { toolCalls?: unknown }).toolCalls)) return null;
  return pa as PendingCEOAction;
}
