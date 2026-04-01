import type { CEOToolName } from "./tools"

/**
 * Short hints so the model turns structured tool output into the right style of user-facing reply.
 */
const TOOL_SUMMARY_HINTS: Record<CEOToolName, string> = {
  chase_rent:
    "State how many tenants are overdue, approximate total overdue amount, and mention a few tenant names when helpful. Note that reminder drafts were prepared.",
  get_maintenance_summary:
    "Lead with urgent items, then open vs in-progress. Summarize the most important tickets by title; do not list raw IDs.",
  qualify_leads:
    "Say how many leads were scored and how many look high priority; summarize reasons in plain language, not as a JSON array.",
  draft_contract:
    "Confirm the tenant’s full name and that a draft was generated; give a one-line status (e.g. draft ready for review). Do not paste the full contract unless the user asks.",
  get_dashboard_summary:
    "Give a compact portfolio snapshot: property and tenant counts, overdue rent pressure, maintenance load, and what deserves attention first.",
  get_rent_status:
    "For the month: paid count vs overdue, totals collected vs still due, and highlight a few names if useful.",
  list_tenants:
    "Give the count and a short bullet list of names (and property if clear); avoid dumping the full table.",
}

/**
 * Wraps raw tool output so the model treats it as internal data and summarizes for the user.
 */
export function wrapToolResultForModel(toolName: CEOToolName, raw: string): string {
  const focus = TOOL_SUMMARY_HINTS[toolName]
  return [
    "Tool output (internal data for you only):",
    "",
    `Summarize for the landlord with this focus: ${focus}`,
    "",
    raw,
    "",
    "Do not repeat this as JSON, code, or key-value dumps in your reply. Translate into clear sentences and bullets per your system instructions.",
  ].join("\n")
}
