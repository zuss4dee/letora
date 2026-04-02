import { looksLikeUuid } from "@/lib/agents/ceo/resolve-tenant-profile";
import { isAffirmativeConfirmation } from "@/lib/agents/ceo/safety";

/**
 * Extract a tenant full name from natural language, e.g. "start onboarding for Alexis Adeosun".
 */
export function extractOnboardingNameFromUserText(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
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
    const text = userMsgs[i].content;
    if (isAffirmativeConfirmation(text)) continue;
    const name = extractOnboardingNameFromUserText(text);
    if (name) return name;
  }
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const name = extractOnboardingNameFromUserText(userMsgs[i].content);
    if (name) return name;
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
