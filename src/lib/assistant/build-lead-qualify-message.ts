import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LEAD_QUALIFY_EMBED_MARKER,
  type LeadQualifyEmbedPayloadV1,
  type LeadQualifyRowPayload,
} from "@/lib/assistant/lead-qualify-embed";

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

type LeadRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
  qualified_status?: string | null;
};

function rowToPayload(l: LeadRow): LeadQualifyRowPayload {
  const pipelineStatus = l.status ?? null;
  const qualificationStatus = l.qualified_status ?? null;
  const pipeline = norm(l.status);
  const qs = norm(l.qualified_status);
  let eligibleForAiQualify = pipeline === "new" && qs === "pending";
  let ineligibleReason: string | null = null;
  if (!eligibleForAiQualify) {
    if (qs !== "pending") {
      ineligibleReason =
        qs === "qualified" || qs === "disqualified"
          ? "Already scored (use /dashboard/leads to change if needed)."
          : `Qualification status is “${qualificationStatus ?? "—"}” (needs **pending** for AI qualify).`;
    } else if (pipeline !== "new") {
      ineligibleReason = `Pipeline stage is “${pipelineStatus ?? "—"}” (needs **new** for AI qualify).`;
    } else {
      ineligibleReason = "Not eligible for automatic qualification.";
    }
  }
  return {
    id: l.id,
    fullName: (l.full_name ?? l.name ?? "Unknown").trim() || "Unknown",
    email: l.email ?? null,
    pipelineStatus,
    qualificationStatus,
    eligibleForAiQualify,
    ineligibleReason,
  };
}

/** Builds assistant message body (plain text + JSON embed) for the manual qualify UI. */
export async function buildLeadQualifyAssistantMessage(
  userId: string,
  supabase: SupabaseClient,
): Promise<string> {
  const { data: rows, error } = await supabase
    .from("leads")
    .select("id, full_name, name, email, status, qualified_status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return `Could not load leads (${error.message}). Open **/dashboard/leads** to manage your pipeline.`;
  }

  const list = rows ?? [];
  const byQualified = (q: string) => list.filter((l) => norm(l.qualified_status) === q).length;
  const byStatus = (s: string) => list.filter((l) => norm(l.status) === s).length;

  const totals = {
    total: list.length,
    new: byStatus("new"),
    pending_qualification: byQualified("pending"),
    qualified: byQualified("qualified"),
    disqualified: byQualified("disqualified"),
  };

  const leads: LeadQualifyRowPayload[] = list.map((l) => rowToPayload(l as LeadRow));

  const payload: LeadQualifyEmbedPayloadV1 = { v: 1, totals, leads };

  const intro = [
    "Here’s your **lead pipeline** (same data as the Leads dashboard):",
    "",
    `• **Total leads:** ${totals.total}`,
    `• **Pipeline “new”:** ${totals.new}`,
    `• **Pending qualification:** ${totals.pending_qualification}`,
    `• **Qualified:** ${totals.qualified} · **Disqualified:** ${totals.disqualified}`,
    "",
    "Use **Qualify with AI** only for leads that are **new** in the pipeline **and** **pending** qualification — that matches the Lead Qualifier agent (Dashboard → Agents). For anything else, use **/dashboard/leads**.",
    "",
  ].join("\n");

  return `${intro}\n${LEAD_QUALIFY_EMBED_MARKER}\n${JSON.stringify(payload)}`;
}
