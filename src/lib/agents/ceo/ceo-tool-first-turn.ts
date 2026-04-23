import type { CEOIntentRoute } from "./intent-router";

/**
 * When the router recommends tools and we are not in the generic “pick a category”
 * clarifier, the model must call at least one tool on the first turn — not emit a
 * “please wait” text block.
 */
export function shouldForceToolChoiceOnFirstTurn(route: CEOIntentRoute): boolean {
  return !route.needsClarification && route.recommendedTools.length > 0;
}

/**
 * Detects assistant text that promises future work without having invoked a tool yet.
 */
export function replyLooksLikeDeferredToolPromise(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 8) return false;
  return (
    /\bplease\s+wait\b/.test(t) ||
    /\b(let me|i'll|i will)\s+(fetch|check|look\s+up|search|pull|get|load|retrieve)\b/.test(t) ||
    /\b(fetching|loading|searching|looking\s+up)\b/.test(t) ||
    /\bhang\s+on\b/.test(t) ||
    /\b(one\s+moment|give\s+me\s+a\s+(moment|second))\b/.test(t) ||
    /\blet\s+me\s+(get|find|pull)\b/.test(t) ||
    /\b(i\s+need\s+to|i'?m\s+going\s+to)\s+.{0,80}?\b(look\s+up|fetch|check|search|pull)\b/.test(t) ||
    /\bsearch\s+your\s+account\b/.test(t)
  );
}

/**
 * User message appended when the model returned text-only instead of tools; forces a retry.
 */
export const CEO_TOOL_NUDGE_USER_MESSAGE =
  "You must call at least one tool in your next assistant message (e.g. list_tenants, draft_contract, get_compliance_summary, get_maintenance_summary, get_leads_summary, get_pending_approvals_summary, chase_rent). Do not reply with only text, and do not say you will fetch data later — call the tool now.";
