import { createClient } from "@/lib/supabase/server";
import type { PendingCEOAction } from "@/lib/agents/ceo/safety";
import type { LetoraSuggestedAction } from "@/lib/agents/ceo/suggested-actions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAssistantConversationId(value: string): boolean {
  return UUID_RE.test(value);
}

export type AssistantChatRole = "user" | "assistant";

export type AssistantMessageMetadata = {
  suggestedActions?: LetoraSuggestedAction[];
  /** When the assistant asked for confirmation, replay this on reload so "yes" still runs tools. */
  pendingCeoAction?: PendingCEOAction;
};

export type AssistantChatMessage = {
  role: AssistantChatRole;
  content: string;
  metadata?: AssistantMessageMetadata | null;
};

export type AssistantConversationListItem = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

/** Rows loaded for UI + API context (chronological order, oldest first). */
export const ASSISTANT_UI_MESSAGE_LIMIT = 30;

/** Max rows retained per conversation after each write (soft cap). */
const ASSISTANT_DB_MAX_MESSAGES = 200;

const DEFAULT_CONVERSATION_TITLE = "New chat";

function deriveConversationTitle(firstUserContent: string): string {
  const line = firstUserContent.split("\n")[0]?.trim() ?? "";
  if (!line) return DEFAULT_CONVERSATION_TITLE;
  return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}

export async function assertConversationOwnedByUser(
  conversationId: string,
  userId: string,
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Unauthorized");
  }
}

export async function listAssistantConversationsForSession(): Promise<
  AssistantConversationListItem[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function createAssistantConversation(
  title: string,
): Promise<AssistantConversationListItem> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const trimmed = title.trim() || DEFAULT_CONVERSATION_TITLE;
  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({
      user_id: user.id,
      title: trimmed.slice(0, 200),
    })
    .select("id, title, created_at, updated_at")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create conversation");
  }

  return {
    id: data.id,
    title: data.title,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function listAssistantMessagesForConversation(
  conversationId: string,
  limit: number,
): Promise<AssistantChatMessage[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: allowed } = await supabase
    .from("assistant_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!allowed) return [];

  const { data, error } = await supabase
    .from("assistant_messages")
    .select("role, content, metadata")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  const chronological = [...data].reverse();
  return chronological.map((row) => {
    const meta = row.metadata as AssistantMessageMetadata | null | undefined;
    return {
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content as string,
      metadata: meta && typeof meta === "object" ? meta : null,
    };
  });
}


async function trimExcessMessagesForConversation(
  conversationId: string,
  userId: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: overflow } = await supabase
    .from("assistant_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(ASSISTANT_DB_MAX_MESSAGES, 100000);

  if (!overflow?.length) return;

  const ids = overflow.map((r) => r.id);
  await supabase.from("assistant_messages").delete().in("id", ids);
}

/**
 * Persists one message. Conversation must belong to the session user.
 */
export async function insertAssistantMessage(
  conversationId: string,
  role: AssistantChatRole,
  content: string,
  metadata?: AssistantMessageMetadata | null,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  await assertConversationOwnedByUser(conversationId, user.id);

  let userMessageCountBefore = 0;
  if (role === "user") {
    const { count } = await supabase
      .from("assistant_messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("role", "user");
    userMessageCountBefore = count ?? 0;
  }

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    conversation_id: conversationId,
    role,
    content,
  };
  if (metadata && Object.keys(metadata).length > 0) {
    insertRow.metadata = metadata;
  }

  const { error } = await supabase.from("assistant_messages").insert(insertRow);

  if (error) throw error;

  const updates: { title?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (role === "user" && userMessageCountBefore === 0) {
    const { data: conv } = await supabase
      .from("assistant_conversations")
      .select("title")
      .eq("id", conversationId)
      .single();

    const currentTitle = conv?.title?.trim() ?? "";
    if (currentTitle === DEFAULT_CONVERSATION_TITLE || currentTitle === "") {
      updates.title = deriveConversationTitle(content);
    }
  }

  await supabase
    .from("assistant_conversations")
    .update(updates)
    .eq("id", conversationId)
    .eq("user_id", user.id);

  await trimExcessMessagesForConversation(conversationId, user.id);
}
