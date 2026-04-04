import { looksLikeUuid } from "@/lib/agents/ceo/resolve-tenant-profile";
import { isAffirmativeConfirmation } from "@/lib/agents/ceo/safety";

/**
 * Light typo fixes for inference only (mobile / fast typing). Does not change stored user text.
 */
export function normalizeUserTextForInference(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  // Adjacent-key slips for "the" (e.g. "draft ghe contract")
  t = t.replace(/\bghe\b/gi, "the");
  t = t.replace(/\bteh\b/gi, "the");
  t = t.replace(/\bhte\b/gi, "the");
  t = t.replace(/\bthw\b/gi, "the");
  t = t.replace(/\bfhe\b/gi, "the");
  t = t.replace(/\bcontrct\b/gi, "contract");
  return t;
}

/**
 * Extract a tenant full name from natural language, e.g. "start onboarding for Alexis Adeosun".
 */
export function extractOnboardingNameFromUserText(text: string): string | null {
  const t = normalizeUserTextForInference(text).replace(/\s+/g, " ").trim();
  if (t.length < 8) return null;

  const patterns: RegExp[] = [
    /\b(?:start\s+)?onboarding\s+for\s+([A-Za-z][A-Za-z'\s-]{2,100})/i,
    /\bonboard(?:ing)?\s+for\s+([A-Za-z][A-Za-z'\s-]{2,100})/i,
  ];

  for (const re of patterns) {
    const m = re.exec(t);
    if (!m?.[1]) continue;
    const name = m[1]
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[.,;:!?]+$/g, "")
      .trim();
    if (name.length >= 3 && name.length <= 100) return name;
  }
  return null;
}

/**
 * Walk user messages newest-first; skip pure "yes" lines, then parse onboarding-for name.
 */
export function inferOnboardingForFromConversation(
  messages: readonly { role: string; content: string }[],
): string | null {
  const userMsgs = messages.filter((m) => m.role === "user");
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const text = normalizeUserTextForInference(userMsgs[i].content);
    if (isAffirmativeConfirmation(text)) continue;
    const name = extractOnboardingNameFromUserText(text);
    if (name) return name;
  }
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const name = extractOnboardingNameFromUserText(normalizeUserTextForInference(userMsgs[i].content));
    if (name) return name;
  }
  return null;
}

const NAME_STOPWORDS = new Set(
  "the a an next last open draft send move tenancy contract property please your their about what when where which".split(
    " ",
  ),
);

/** "for Alexis Adeosun", "about Jane Smith" */
function extractNameAfterForOrAbout(text: string): string | null {
  const t = normalizeUserTextForInference(text).replace(/\s+/g, " ").trim();
  const patterns = [
    /\b(?:for|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/,
    /\b(?:tenant|named?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/,
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m?.[1]) {
      const n = m[1].trim().replace(/[.,;:!?]+$/g, "");
      const first = n.split(/\s+/)[0]?.toLowerCase() ?? "";
      if (NAME_STOPWORDS.has(first)) continue;
      if (n.length >= 5 && n.length <= 80) return n;
    }
  }
  return null;
}

/** "Alexis Adeosun" in assistant headings (last plausible match). */
function extractCapitalizedFullNameFromAssistant(text: string): string | null {
  const m = /\b([A-Z][a-z]{2,20}\s+[A-Z][a-z]{2,20})\b/g;
  let best: string | null = null;
  for (const match of text.matchAll(m)) {
    const n = match[1]?.trim();
    if (!n) continue;
    const parts = n.split(/\s+/);
    const a = parts[0]?.toLowerCase() ?? "";
    const b = parts[1]?.toLowerCase() ?? "";
    if (NAME_STOPWORDS.has(a) || NAME_STOPWORDS.has(b)) continue;
    if (/\b(letora|assistant|united|kingdom|dashboard|tenancy|contract)\b/i.test(n)) continue;
    best = n;
  }
  return best;
}

/**
 * Broader than onboarding-for phrasing: user "for Name", or last assistant "Firstname Lastname"
 * (so "draft the contract now" still resolves after the assistant named the tenant).
 */
export function inferTenantOrContractNameFromConversation(
  messages: readonly { role: string; content: string }[],
): string | null {
  const fromOnboarding = inferOnboardingForFromConversation(messages);
  if (fromOnboarding) return fromOnboarding;

  const userMsgs = messages.filter((m) => m.role === "user");
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const text = normalizeUserTextForInference(userMsgs[i].content);
    if (isAffirmativeConfirmation(text)) continue;
    const name = extractNameAfterForOrAbout(text);
    if (name) return name;
  }
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const name = extractNameAfterForOrAbout(normalizeUserTextForInference(userMsgs[i].content));
    if (name) return name;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "assistant") continue;
    const name = extractCapitalizedFullNameFromAssistant(normalizeUserTextForInference(messages[i].content));
    if (name) return name;
  }
  return null;
}

/** UK-style address fragments: "101 Billionaires Row", "for 101 ..." */
export function extractPropertyAddressHintFromText(text: string): string | null {
  const t = normalizeUserTextForInference(text)
    .replace(/\*+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const patterns = [
    /\b(?:for|at)\s+(\d{1,4}\s+[A-Za-z][A-Za-z\s'.-]{4,100})\b/i,
    /\bit\s+is\s+for\s+(\d{1,4}\s+[A-Za-z][A-Za-z\s'.-]{4,100})\b/i,
    /\b(\d{1,4}\s+[A-Za-z][A-Za-z\s'.-]{3,80}(?:row|road|street|lane|avenue|way|close|drive|gardens?|london))\b/i,
    /\b(\d{1,4}\s+billionaires\s+row)\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m?.[1]) {
      const s = m[1].trim().replace(/[.,;:!?]+$/g, "");
      if (s.length >= 6 && s.length <= 120) return s;
    }
  }
  return null;
}

export function inferPropertyAddressHintFromConversation(
  messages: readonly { role: string; content: string }[],
): string | null {
  const userMsgs = messages.filter((m) => m.role === "user");
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const text = normalizeUserTextForInference(userMsgs[i].content);
    if (isAffirmativeConfirmation(text)) continue;
    const h = extractPropertyAddressHintFromText(text);
    if (h) return h;
  }
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const h = extractPropertyAddressHintFromText(normalizeUserTextForInference(userMsgs[i].content));
    if (h) return h;
  }
  // Assistant often repeats the property line (e.g. after onboarding resume) — reuse for draft_contract hints.
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "assistant") continue;
    const h = extractPropertyAddressHintFromText(normalizeUserTextForInference(messages[i].content));
    if (h) return h;
  }
  return null;
}

/**
 * When the model omits `onboarding_for` on the pending tool call, recover from chat history
 * (e.g. user said "start onboarding for Jane" then "yes").
 */
export function mergeEnrichedOnboardingInput(
  input: Record<string, string>,
  inferredName: string | null,
): Record<string, string> {
  const out = { ...input };

  if ((out.tenancy_id?.trim() ?? "") !== "") return out;
  if ((out.onboarding_for?.trim() ?? "") !== "") return out;

  const leadId = out.lead_id?.trim() ?? "";
  const auto = out.auto_create_tenant_and_tenancy;
  if (leadId && auto === "true") return out;

  const t = out.tenant_id?.trim() ?? "";
  const p = out.property_id?.trim() ?? "";
  const s = out.start_date?.trim() ?? "";
  if (t && p && s && !leadId) return out;

  if (t && !looksLikeUuid(t)) {
    out.onboarding_for = t;
    return out;
  }

  if (inferredName) {
    out.onboarding_for = inferredName;
  }
  return out;
}

/**
 * When the model omits **draft_contract** args, recover from conversation + server onboarding prefetch.
 * **tenancy_id** from prefetch wins (same JSON the assistant was shown).
 */
export function mergeDraftContractInput(
  input: Record<string, string>,
  inferredName: string | null,
  inferredPropertyHint: string | null,
  onboardingPrefetchRaw: string | null,
): Record<string, string> {
  const out = { ...input };

  if (!out.tenancy_id?.trim() && onboardingPrefetchRaw) {
    try {
      const o = JSON.parse(onboardingPrefetchRaw) as {
        tenancy_id?: string;
        success?: boolean;
        mode?: string;
      };
      if (
        typeof o.tenancy_id === "string" &&
        o.tenancy_id.length > 0 &&
        (o.success === true || o.mode === "resume")
      ) {
        out.tenancy_id = o.tenancy_id;
        return out;
      }
    } catch {
      /* ignore */
    }
  }

  if (out.tenancy_id?.trim()) {
    if (!out.onboarding_property_hint?.trim() && inferredPropertyHint) {
      out.onboarding_property_hint = inferredPropertyHint;
    }
    return out;
  }

  if (out.tenant_id?.trim() || out.tenant_name?.trim()) {
    if (!out.onboarding_property_hint?.trim() && inferredPropertyHint) {
      out.onboarding_property_hint = inferredPropertyHint;
    }
    return out;
  }

  if (inferredName) {
    out.tenant_name = inferredName;
  }
  if (!out.onboarding_property_hint?.trim() && inferredPropertyHint) {
    out.onboarding_property_hint = inferredPropertyHint;
  }
  return out;
}
