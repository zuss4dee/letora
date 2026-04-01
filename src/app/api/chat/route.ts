import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import {
  parsePendingCEOActionFromJson,
  runCEOChat,
} from "@/lib/agents/ceo";
import type { CEOMessage } from "@/lib/agents/ceo";
import {
  assertConversationOwnedByUser,
  insertAssistantMessage,
  isAssistantConversationId,
} from "@/lib/assistant-messages/store";
import { checkChatRateLimit } from "@/lib/chat-rate-limit";
import { createClient } from "@/lib/supabase/server";

type ResolvedAuth =
  | { user: User; message: null }
  | { user: null; message: string };

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

function isCEOMessageArray(value: unknown): value is CEOMessage[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    if (!("role" in item) || !("content" in item)) return false;
    const rec = item as { role: unknown; content: unknown };
    return (
      (rec.role === "user" || rec.role === "assistant") &&
      typeof rec.content === "string"
    );
  });
}

async function resolveAuthenticatedUser(request: Request): Promise<ResolvedAuth> {
  const supabase = await createClient();
  const bearer = getBearerToken(request);

  if (bearer) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearer);
    if (error || !user) {
      return {
        user: null,
        message:
          "Invalid or expired access token. Sign in again or refresh your session.",
      };
    }
    return { user, message: null };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      message: "You must be signed in to use the assistant.",
    };
  }

  return { user, message: null };
}

function mapAssistantError(err: unknown): { status: number; code: string; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many requests")) {
    return {
      status: 429,
      code: "rate_limited",
      message: "The assistant is busy. Please wait a moment and try again.",
    };
  }
  if (
    lower.includes("billing") ||
    lower.includes("payment required") ||
    lower.includes("insufficient") ||
    lower.includes("credit balance")
  ) {
    return {
      status: 402,
      code: "billing",
      message: "AI service billing issue. Please check your API account and try again later.",
    };
  }
  if (lower.includes("invalid api key") || lower.includes("401") || lower.includes("authentication")) {
    return {
      status: 503,
      code: "misconfigured",
      message: "Assistant is temporarily unavailable. Please try again later.",
    };
  }
  if (lower.includes("supabase") || lower.includes("database") || lower.includes("postgres")) {
    return {
      status: 503,
      code: "database",
      message: "Could not reach the database. Please try again in a moment.",
    };
  }
  if (lower.includes("ai services are temporarily unavailable")) {
    return {
      status: 503,
      code: "ai_unavailable",
      message: "AI services are temporarily unavailable. Please try again shortly.",
    };
  }
  return {
    status: 500,
    code: "internal",
    message: "Something went wrong. Please try again.",
  };
}

function chunkUtf8Text(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return text ? [text] : [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  return chunks;
}

export async function POST(request: Request) {
  const authResult = await resolveAuthenticatedUser(request);
  if (!authResult.user) {
    return NextResponse.json({ error: authResult.message }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("messages" in body)) {
    return NextResponse.json(
      { error: "Request body must include a messages array." },
      { status: 400 },
    );
  }

  const bodyObj = body as Record<string, unknown>;
  const { messages } = bodyObj;

  const rawConversationId = bodyObj.conversationId;
  if (
    typeof rawConversationId !== "string" ||
    !isAssistantConversationId(rawConversationId)
  ) {
    return NextResponse.json(
      { error: "Request body must include a valid conversationId (UUID)." },
      { status: 400 },
    );
  }
  const conversationId = rawConversationId;

  try {
    await assertConversationOwnedByUser(conversationId, authResult.user.id);
  } catch {
    return NextResponse.json(
      { error: "Conversation not found or access denied." },
      { status: 403 },
    );
  }

  if (!isCEOMessageArray(messages)) {
    return NextResponse.json(
      {
        error:
          'messages must be an array of { role: "user" | "assistant", content: string }.',
      },
      { status: 400 },
    );
  }

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "messages must contain at least one entry." },
      { status: 400 },
    );
  }

  let pendingAction = null;
  if (bodyObj.confirmedExecution === true && bodyObj.pendingAction !== undefined) {
    pendingAction = parsePendingCEOActionFromJson(bodyObj.pendingAction);
    if (!pendingAction) {
      return NextResponse.json(
        { error: "Invalid or missing pendingAction for confirmed execution." },
        { status: 400 },
      );
    }
  }

  const userId = authResult.user.id;

  const rl = checkChatRateLimit(userId);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "Too many requests. Slow down and try again shortly.",
        code: "rate_limited",
        retryAfterSec: rl.retryAfterSec,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const last = messages[messages.length - 1];
  if (last.role === "user") {
    try {
      await insertAssistantMessage(conversationId, "user", last.content);
    } catch {
      return NextResponse.json(
        { error: "Could not save your message. Please try again." },
        { status: 500 },
      );
    }
  }

  let result;
  try {
    result = await runCEOChat({
      userId,
      messages,
      confirmedExecution: bodyObj.confirmedExecution === true,
      pendingAction,
    });
  } catch (err) {
    const mapped = mapAssistantError(err);
    console.error("[/api/chat] runCEOChat failed", {
      mapped,
      raw: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (result.outcome === "needs_clarification") {
    try {
      await insertAssistantMessage(conversationId, "assistant", result.message);
    } catch {
      return NextResponse.json(
        { error: "Could not save the assistant reply." },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        needsClarification: true,
        message: result.message,
      },
      { status: 200 },
    );
  }

  if (result.outcome === "needs_confirmation") {
    try {
      await insertAssistantMessage(conversationId, "assistant", result.message);
    } catch {
      return NextResponse.json(
        { error: "Could not save the assistant reply." },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        needsConfirmation: true,
        message: result.message,
        pendingAction: result.pendingAction,
      },
      { status: 200 },
    );
  }

  try {
    await insertAssistantMessage(conversationId, "assistant", result.reply);
  } catch {
    return NextResponse.json(
      { error: "Could not save the assistant reply." },
      { status: 500 },
    );
  }

  const encoder = new TextEncoder();
  const pieces = chunkUtf8Text(result.reply, 64);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        for (const piece of pieces) {
          controller.enqueue(encoder.encode(piece));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
