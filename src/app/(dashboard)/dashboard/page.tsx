export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AssistantChat } from "./assistant/assistant-chat";
import { CommandCenterLandingView } from "@/components/dashboard/command-center/command-center-landing-view";
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

/**
 * Command Center hub at `/dashboard`:
 * - No `?c=` → landing (Letora home).
 * - `?q=` → new conversation + redirect to `?c=&start=`.
 * - `?c=` → full chat (history + thread).
 *
 * Legacy `/dashboard/assistant` and `/dashboard/home` funnel here (`next.config.ts`, `assistant/page.tsx`).
 * `/dashboard/rent` (and `/dashboard/rent/`) → `/dashboard/rent-tracker` via `next.config.ts` and `rent/page.tsx`.
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

  /** Landing: Command Center UI; dynamic sections load behind Suspense (see command-center-*). */
  if (!requested) {
    if (!user?.id) redirect("/login");
    return (
      <div className="relative flex min-h-0 flex-1 flex-col bg-[#0B0B0B]">
        <CommandCenterLandingView userId={user.id} />
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col border border-border/80 bg-card md:mx-6 md:mb-6 md:mt-1 md:rounded-2xl md:shadow-sm dark:border-white/[0.06] dark:bg-background dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
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
