import { redirect } from "next/navigation";

import { AssistantChat } from "./assistant-chat";
import {
  ASSISTANT_UI_MESSAGE_LIMIT,
  createAssistantConversation,
  listAssistantConversationsForSession,
  listAssistantMessagesForConversation,
} from "@/lib/assistant-messages/store";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; start?: string }>;
}) {
  const sp = await searchParams;
  const startParam = typeof sp.start === "string" ? sp.start : undefined;

  let conversations = await listAssistantConversationsForSession();

  if (conversations.length === 0) {
    const created = await createAssistantConversation("New chat");
    conversations = [created];
  }

  const requested = typeof sp.c === "string" ? sp.c : undefined;
  let activeId: string;
  if (requested && conversations.some((c) => c.id === requested)) {
    activeId = requested;
  } else {
    activeId = conversations[0]!.id;
  }

  if (sp.c !== activeId) {
    const q = new URLSearchParams();
    q.set("c", activeId);
    if (startParam) q.set("start", startParam);
    redirect(`/dashboard/assistant?${q.toString()}`);
  }

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
    startParam && startParam.trim() && initialMessages.length === 0 ? startParam.trim() : undefined;

  return (
    <AssistantChat
      key={activeId}
      conversations={conversations}
      activeConversationId={activeId}
      initialMessages={initialMessages}
      initialPromptToSend={starter}
    />
  );
}
