export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import {
  createAssistantConversation,
  listAssistantConversationsForSession,
} from "@/lib/assistant-messages/store";

function searchParamsToQueryString(
  sp: Record<string, string | string[] | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp)) {
    if (raw === undefined) continue;
    if (Array.isArray(raw)) {
      for (const v of raw) q.append(key, v);
    } else {
      q.set(key, raw);
    }
  }
  return q.toString();
}

/**
 * /dashboard/assistant → opens the chat view.
 * - If ?c= is passed, forward all query params to the Command Center chat.
 * - If the user has existing conversations, open the most recent one.
 * - Otherwise create a fresh conversation and open it.
 */
export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  if (typeof sp.c === "string" && sp.c) {
    const qs = searchParamsToQueryString(sp);
    redirect(qs ? `/dashboard?${qs}` : "/dashboard");
  }

  const existing = await listAssistantConversationsForSession();
  if (existing.length > 0) {
    redirect(`/dashboard?c=${encodeURIComponent(existing[0].id)}`);
  }

  const created = await createAssistantConversation("New chat");
  redirect(`/dashboard?c=${encodeURIComponent(created.id)}`);
}
