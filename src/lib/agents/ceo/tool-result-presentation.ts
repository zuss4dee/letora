import type { CEOToolName } from "./tools"

/**
 * Short hints so the model turns structured tool output into the right style of user-facing reply.
 */
const TOOL_SUMMARY_HINTS: Record<CEOToolName, string> = {
  chase_rent:
    "State how many tenants are overdue, approximate total overdue amount, and mention a few tenant names when helpful. Note that reminder drafts were prepared.",
  get_maintenance_summary:
    "Lead with urgent items, then open vs in-progress. Summarize the most important tickets by title; do not list raw IDs.",
  get_leads_summary:
    "State whether there are any new leads, then give pending/qualified/disqualified counts and a short list of recent lead names when helpful.",
  search_properties:
    "List matching properties with their **id** (UUID), human-readable label, and hint if multiple matches — tell the user to pick the right one before mutating tools. Never treat a unit number as a UUID.",
  start_tenant_onboarding:
    "Confirm what onboarding started, whether any tenant/tenancy records were created, how many tasks were created, and whether welcome email was drafted/sent.",
  dispatch_maintenance_request:
    "Confirm issue logged, inferred category/urgency, and contractor dispatch status (drafted/sent/failed). Keep next steps practical.",
  generate_property_listing:
    "Share polished listing copy summary and whether it was saved to the property record or returned as preview only.",
  qualify_leads:
    "If the JSON has error/details, lead with that in plain language. If message says no pending leads, say so. If parse_ok is false or parse_failed is true, explain briefly and use hint + /dashboard/leads — never generic 'technical failure' boilerplate. Otherwise: how many scored, outcomes, reasons in prose (not raw JSON).",
  nurture_lead:
    "Confirm the pipeline step taken, new status, and whether the email was sent or saved as a draft (per settings). Do not paste the full email unless asked.",
  decide_lead_application:
    "State clearly whether the applicant was approved or rejected and that the lead record was updated.",
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
  const qualifyExtra =
    toolName === "qualify_leads"
      ? [
          "",
          "Mandatory for qualify_leads: read the JSON fields. If `error` or `details` exists, your reply must reflect them. If `parse_failed` or `parse_ok: false`, do not blame a vague platform outage — say parsing/application failed and suggest /dashboard/leads per `hint`.",
        ]
      : []
  return [
    "Tool output (internal data for you only):",
    "",
    `Summarize for the landlord with this focus: ${focus}`,
    ...qualifyExtra,
    "",
    raw,
    "",
    "Do not repeat this as JSON, code, or key-value dumps in your reply. Translate into clear sentences and bullets per your system instructions.",
  ].join("\n")
}
