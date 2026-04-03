import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_ROWS = 6;
/** Include inbound events from this window so the CEO sees fresh agency replies without huge prompts. */
const SINCE_HOURS = 72;

/**
 * Compact lines for CEO system prompt — so the model knows about recent agency replies
 * without waiting for the user to ask or call a tool.
 */
export async function fetchReferencingInboundDigestForCeo(
  userId: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const since = new Date(Date.now() - SINCE_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("referencing_events")
    .select("created_at, subject, body_preview, outcome")
    .eq("user_id", userId)
    .eq("direction", "inbound")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error || !data?.length) return null;

  const lines: string[] = [];
  for (const row of data) {
    const created = typeof row.created_at === "string" ? row.created_at.slice(0, 19).replace("T", " ") : "";
    const subj = (row.subject as string | null)?.slice(0, 100) ?? "";
    const preview = (row.body_preview as string | null)?.slice(0, 200) ?? "";
    const outcome = (row.outcome as string | null) ?? "—";
    lines.push(
      `- ${created} UTC · subject: ${subj || "—"} · outcome: ${outcome} · preview: ${preview || "—"}`,
    );
  }

  return [
    `Recent referencing agency inbound mail (last ${SINCE_HOURS}h, newest first; stored in Letora — **must** be reflected when the user asks about agency replies, referencing updates, or “any news”):`,
    ...lines,
  ].join("\n");
}
