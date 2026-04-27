export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { AssistantChat } from "./assistant-chat";
import {
  ASSISTANT_UI_MESSAGE_LIMIT,
  createAssistantConversation,
  listAssistantConversationsForSession,
  listAssistantMessagesForConversation,
} from "@/lib/assistant-messages/store";
import { createClient } from "@/lib/supabase/server";

function deriveTitleFromFirstLine(text: string) {
  const line = text.split("\n")[0]?.trim() ?? "";
  if (!line) return "New session";
  return line.length > 200 ? `${line.slice(0, 199)}…` : line;
}

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string; start?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) redirect("/login");

  // ?q= → create new conversation and redirect
  const qParam = typeof sp.q === "string" ? sp.q.trim() : "";
  if (qParam) {
    const created = await createAssistantConversation(deriveTitleFromFirstLine(qParam));
    redirect(
      `/dashboard/assistant?c=${encodeURIComponent(created.id)}&start=${encodeURIComponent(qParam)}`,
    );
  }

  const requested = typeof sp.c === "string" ? sp.c : undefined;

  let conversations = await listAssistantConversationsForSession();
  if (conversations.length === 0) {
    const created = await createAssistantConversation("New session");
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
    redirect(`/dashboard/assistant?${q.toString()}`);
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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#0B0B0B]">
      {/* ── Page Header ── */}
      <header className="border-b border-[#1f1f1f] bg-[#0B0B0B] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center bg-white">
            <Sparkles className="size-3.5 text-[#0B0B0B]" />
          </div>
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[#555555]">
              Letora AI
            </p>
            <h1 className="text-[13px] font-bold uppercase tracking-tight text-white">
              Deep Work Mode
            </h1>
          </div>
        </div>
      </header>

      {/* ── Chat UI ── */}
      <div className="flex min-h-0 flex-1">
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
