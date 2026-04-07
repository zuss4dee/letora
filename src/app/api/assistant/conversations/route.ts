import { NextResponse } from "next/server";

import {
  createAssistantConversation,
  listAssistantConversationsForSession,
} from "@/lib/assistant-messages/store";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TITLE = "New chat";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  try {
    const conversations = await listAssistantConversationsForSession();
    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to create a conversation." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let title = DEFAULT_TITLE;
  if (typeof body === "object" && body !== null && "title" in body) {
    const raw = (body as Record<string, unknown>).title;
    if (typeof raw === "string") {
      const t = raw.trim();
      if (t.length > 0) {
        title = t.slice(0, 200);
      }
    }
  }

  try {
    const row = await createAssistantConversation(title);
    return NextResponse.json(
      {
        id: row.id,
        title: row.title,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not create conversation. Please try again." },
      { status: 500 },
    );
  }
}
