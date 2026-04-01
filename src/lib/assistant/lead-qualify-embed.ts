/** Persisted assistant message embed for manual “qualify with AI” UI (chat). */

export const LEAD_QUALIFY_EMBED_MARKER = "__LETORA_LEAD_QUALIFY_V1__";

export type LeadQualifyRowPayload = {
  id: string;
  fullName: string;
  email: string | null;
  pipelineStatus: string | null;
  qualificationStatus: string | null;
  eligibleForAiQualify: boolean;
  ineligibleReason: string | null;
};

export type LeadQualifyEmbedPayloadV1 = {
  v: 1;
  totals: {
    total: number;
    new: number;
    pending_qualification: number;
    qualified: number;
    disqualified: number;
  };
  leads: LeadQualifyRowPayload[];
};

function normalizeForRouting(text: string): string {
  const t = text.toLowerCase();
  return t
    .replace(/\btenats\b/g, "tenants")
    .replace(/\btenent(s)?\b/g, "tenant$1")
    .replace(/\btennant(s)?\b/g, "tenant$1")
    .replace(/\barreers\b/g, "arrears")
    .replace(/\barrers\b/g, "arrears")
    .replace(/\bmaintenence\b/g, "maintenance")
    .replace(/\bmaintainance\b/g, "maintenance")
    .replace(/\bcontrcat(s)?\b/g, "contract$1")
    .replace(/\bleadz\b/g, "leads")
    .replace(/\bproeprty\b/g, "property")
    .replace(/\bdashbord\b/g, "dashboard");
}

/**
 * When the user asks to qualify leads in plain language, show pipeline summary + per-lead buttons
 * instead of running the CEO tool loop (unless they bundle other actions in the same message).
 */
export function shouldOfferManualLeadQualifyUi(latestUserText: string): boolean {
  const n = normalizeForRouting(latestUserText.trim());
  if (!/\bqualify\b/i.test(n) || !/\bleads?\b/i.test(n)) return false;
  if (
    /\b(and|also|then)\b/i.test(n) &&
    /\b(chase|overdue|rent|maintenance|dispatch|onboard|contract|listing|draft|send|blast)\b/i.test(n)
  ) {
    return false;
  }
  return true;
}

export function parseLeadQualifyEmbed(content: string): {
  introText: string;
  payload: LeadQualifyEmbedPayloadV1;
} | null {
  const idx = content.indexOf(LEAD_QUALIFY_EMBED_MARKER);
  if (idx === -1) return null;
  const introText = content.slice(0, idx).trimEnd();
  const jsonPart = content.slice(idx + LEAD_QUALIFY_EMBED_MARKER.length).trim();
  try {
    const raw = JSON.parse(jsonPart) as unknown;
    if (typeof raw !== "object" || raw === null) return null;
    const o = raw as Record<string, unknown>;
    if (o.v !== 1 || !Array.isArray(o.leads) || typeof o.totals !== "object" || o.totals === null) {
      return null;
    }
    return { introText, payload: raw as LeadQualifyEmbedPayloadV1 };
  } catch {
    return null;
  }
}
