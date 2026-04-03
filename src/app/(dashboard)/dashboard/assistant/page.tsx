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
  searchParams: Promise<{ c?: string }>;
}) {
  const sp = await searchParams;
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
    redirect(`/dashboard/assistant?c=${activeId}`);
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

  return (
    <AssistantChat
      key={activeId}
      conversations={conversations}
      activeConversationId={activeId}
      initialMessages={initialMessages}
    />
  );
}
