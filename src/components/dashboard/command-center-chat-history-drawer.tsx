"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AssistantConversationList } from "@/components/dashboard/assistant-conversation-list";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { AssistantConversationListItem } from "@/lib/assistant-messages/store";

/**
 * Mobile-only drawer for assistant thread list when Command Center is in chat mode (`/dashboard?c=`).
 */
export function CommandCenterChatHistoryDrawer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeConversationId = searchParams.get("c")?.trim() ?? "";

  const onDashboard =
    pathname === "/dashboard" || pathname === "/dashboard/";
  const showTrigger = onDashboard && activeConversationId.length > 0;

  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<AssistantConversationListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/assistant/conversations", { cache: "no-store" });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error?: unknown }).error ?? res.statusText)
            : res.statusText;
        setLoadError(msg);
        setConversations([]);
        return;
      }
      const list =
        typeof data === "object" && data !== null && "conversations" in data
          ? (data as { conversations?: AssistantConversationListItem[] }).conversations
          : undefined;
      setConversations(Array.isArray(list) ? list : []);
    } catch {
      setLoadError("Could not load conversations.");
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    if (open) void loadConversations();
  }, [open, loadConversations]);

  if (!showTrigger) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          aria-label="Chat history"
        >
          <Clock className="size-[18px]" strokeWidth={1.75} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-[300px] max-w-[300px] flex-col border-l border-zinc-200 bg-white p-0 sm:max-w-[300px] dark:border-[#232323] dark:bg-[#111111]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <SheetTitle className="sr-only">Active sessions</SheetTitle>
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-[#232323]">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Active Sessions</p>
            <SheetClose asChild>
              <Link
                href="/dashboard"
                className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                New chat
              </Link>
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadError ? (
              <p className="px-4 py-3 text-xs text-red-600 dark:text-red-400">{loadError}</p>
            ) : (
              <AssistantConversationList
                conversations={conversations}
                activeConversationId={activeConversationId}
                variant="sidebar"
                onConversationNavigate={() => setOpen(false)}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
