import { NextResponse } from "next/server";

import {
  ASSISTANT_UI_MESSAGE_LIMIT,
  listAssistantMessagesForConversation,
} from "@/lib/assistant-messages/store";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: conversationId } = await params;

  try {
    const rawMessages = await listAssistantMessagesForConversation(
      conversationId,
      ASSISTANT_UI_MESSAGE_LIMIT,
    );
    const messages = rawMessages.map((m) => ({
      role: m.role,
      content: m.content,
      suggestedActions: m.metadata?.suggestedActions,
      pendingCeoAction: m.metadata?.pendingCeoAction,
    }));
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  }
}
