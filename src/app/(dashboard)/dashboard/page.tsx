export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AssistantChat } from "./assistant/assistant-chat";
import { AssistantLanding } from "@/components/dashboard/assistant-landing";
import {
  ASSISTANT_UI_MESSAGE_LIMIT,
  createAssistantConversation,
  listAssistantConversationsForSession,
  listAssistantMessagesForConversation,
} from "@/lib/assistant-messages/store";
import { createClient } from "@/lib/supabase/server";

function deriveTitleFromFirstLine(text: string) {
  const line = text.split("\n")[0]?.trim() ?? "";
  if (!line) return "New chat";
  return line.length > 200 ? `${line.slice(0, 199)}…` : line;
}

function firstNameFromUser(email: string | null | undefined): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "there";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Single dashboard workspace: no separate “overview” or `/assistant` route.
 * - No `?c=` → new-message landing (Letora home).
 * - `?q=` → new conversation + redirect to `?c=&start=`.
 * - `?c=` → full chat (history sidebar + thread).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string; start?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const qParam = typeof sp.q === "string" ? sp.q.trim() : "";
  if (qParam) {
    const created = await createAssistantConversation(deriveTitleFromFirstLine(qParam));
    redirect(
      `/dashboard?c=${encodeURIComponent(created.id)}&start=${encodeURIComponent(qParam)}`,
    );
  }

  const requested = typeof sp.c === "string" ? sp.c : undefined;

  /** Landing: focus on starting a message; chat history opens via “All chats” or direct `?c=` links. */
  if (!requested) {
    const conversations = await listAssistantConversationsForSession();

    return (
      <div className="relative flex min-h-0 flex-1 flex-col bg-[#0E0E0E]">
        <div className="mx-auto w-full max-w-7xl flex-1 px-6 pb-16 pt-4 md:px-12 md:pt-2">
          <div className="mx-auto max-w-5xl">
            <AssistantLanding
              greetingName={firstNameFromUser(user?.email)}
              conversations={conversations}
            />
          </div>
        </div>
      </div>
    );
  }

  let conversations = await listAssistantConversationsForSession();

  if (conversations.length === 0) {
    const created = await createAssistantConversation("New chat");
    conversations = [created];
  }

  let activeId: string;
  if (requested && conversations.some((c) => c.id === requested)) {
    activeId = requested;
  } else {
    activeId = conversations[0]!.id;
  }

  if (sp.c !== activeId) {
    const q = new URLSearchParams();
    q.set("c", activeId);
    const legacyStart = typeof sp.start === "string" ? sp.start.trim() : "";
    if (legacyStart) q.set("start", legacyStart);
    redirect(`/dashboard?${q.toString()}`);
  }

  const legacyStart = typeof sp.start === "string" ? sp.start.trim() : "";

  const rawMessages = await listAssistantMessagesForConversation(
    activeId,
    ASSISTANT_UI_MESSAGE_LIMIT,
  );
  const initialMessages = rawMessages.map((m) => ({
    role: m.role,
    content: m.content,
    suggestedActions: m.metadata?.suggestedActions,
    pendingCeoAction: m.metadata?.pendingCeoAction,
  }));

  const starter =
    legacyStart && legacyStart.trim() && initialMessages.length === 0
      ? legacyStart.trim()
      : undefined;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#0E0E0E]">
      <div className="flex min-h-0 flex-1 flex-col border border-[#484848]/25 bg-[#131313]/35 backdrop-blur-xl md:mx-4 md:mb-4 md:mt-0 md:rounded-xl">
        <AssistantChat
          key={activeId}
          conversations={conversations}
          activeConversationId={activeId}
          initialMessages={initialMessages}
          initialPromptToSend={starter}
        />
      </div>
    </div>
  );
}
