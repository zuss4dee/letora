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
    "If **mode** is **resume**, onboarding is already running — follow **ceo_resume_hint**, list **pending_task_names**, and give **tasks_complete**/**tasks_total**. When **referencing_complete** is true, do **not** say the user must wait for the referencing agency (referencing is done or marked complete on the tenancy). End by asking if they want help with the next pending items (e.g. send move-in email, draft contract). For a fresh start (**success** with tasks created), confirm welcome email draft/sent and task count. **Letora has no tenant-facing portal.** Tenants are contacted by **email** only. Onboarding **tasks** are for the **landlord** (dashboard). If the tool returned candidates (multiple tenancies), ask for street/city.",
  send_referencing_handoff:
    "Read **sent** (boolean) and **message**. Use **tenant_name** / **property_address** when describing who the handoff was for. Do **not** quote **tenancy_id** in prose. If sent is true, confirm the email was sent to the agency. If sent is false, say what happened per **message** — never claim the email was sent unless sent is true.",
  prepare_referencing:
    "Follow **ceo_instruction** verbatim for what to say about inbound mail. Summarize **recent_inbound_mail** previews when present. **onboarding_status**, **referencing_complete**, **handoff_sent**, **referencing_last_inbound_at**, **tasks** / **tasks_complete**/**tasks_total**. If missing_agency_email, point to Settings → Email & Automation (referencing). If handoff_sent is true, do not imply the user still needs to send the first handoff.",
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
    "Read **saved**, **contract_id**, **property_match**, **message**, **error**, and **code**. If **code** is **llm_error** or **save_failed**, repeat the **error** string in plain language — do **not** blame “tenant record resolution”, “backend configuration”, “synchronization”, or “sync” unless those exact words appear in **error**. If **code** is **matched_by_fallback**, ask if the property in **message** is the right one. If **code** is **ambiguous_match**, list **candidates** and ask which address they mean. If **code** is **no_property_match**, use **message** in plain language. If **code** is **ambiguous_tenancy**, **multiple_tenants**, or **tenant_name_mismatch**, list **candidates** and ask the user to pick — do **not** say the tenancy does not exist at that address. If **saved** is true, confirm the **tenancy agreement** draft was saved and mention review under **/dashboard/contracts**. **tenancy_id** may be omitted when the draft matched tenant + property without a separate tenancy row. Do not paste internal instructions, “Next steps”, or raw URLs. Do not paste the full document unless asked.",
  send_contract:
    "Read **success** and **message**. If success is true, confirm the **tenancy agreement** was sent to the tenant and they received a signing link by email. Include tenant name and property address. If success is false, explain using the **message** field.",
  get_contracts:
    "List rows found: for each, mention tenant name, property address, status (draft/sent/signed/active), and contract_id. In prose say **tenancy agreement**, not “contract”, unless quoting data. If none found, say so and suggest drafting one first.",
  send_move_in_email:
    "Read **success**, **message**, and **email_log_id** when present. If success is true, confirm move-in instructions were emailed to the tenant. If false, explain using **message** and do not claim the email was sent.",
  get_dashboard_summary:
    "Give a compact portfolio snapshot: property and tenant counts, overdue rent pressure, maintenance load, **compliance_issue_count**, **compliance_gap_count** (missing expiry / undated certs), **compliance_expiring_soon_count** from the JSON (legal certificates — not repairs), and what deserves attention first.",
  get_compliance_summary:
    "Lead with **compliance_issue_count** and **compliance_gap_count**. List compliance issues (expired or expiry before today) and gaps (**is_compliance_gap** / status missing) with certificate_type and property_address. Mention **expiring_within_30_days_count** separately. Do not confuse with maintenance tickets — **definition** in the JSON explains the rule.",
  get_rent_status:
    "Prioritize **tenancies** in the JSON: monthly_rent, start_date, move_in_date, tenancy_status, rent_due_day_of_month, rent_schedule_hint, first_payment_record. Use **payments** for that month’s paid/overdue. Never say you lack rent amount or tenancy start date when **tenancies** includes them. If **ambiguity_note** is set, follow it.",
  list_tenants:
    "Give the count and a short bullet list of names (and property if clear); avoid dumping the full table.",
  resolve_onboarding_navigation:
    "If ok=true, the JSON includes **pending_task_names**, **referencing_complete**, **tasks_complete**/**tasks_total** (same as resume). Summarize **only** those fields — do **not** invent a generic “welcome / move-in / tenancy agreement” list. If **referencing_complete** is true, do **not** say referencing is still pending. Give the **Open onboarding** button (UI). If needs_tenant or multiple_tenants, ask which tenant or use chips. If multiple_tenancies, ask them to pick the right property. Do not paste raw JSON.",
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
  const onboardingExtra =
    toolName === "start_tenant_onboarding"
      ? [
          "",
          "Mandatory for start_tenant_onboarding: never mention a tenant portal, tenant app, or tenant login in Letora. Communication with tenants is by email. Task lists are visible to the landlord in the dashboard. If JSON has **mode: \"resume\"**, obey **ceo_resume_hint** — do not imply onboarding can be \"restarted\" or that referencing is still pending when **referencing_complete** is true.",
        ]
      : []
  const referencingHandoffExtra =
    toolName === "send_referencing_handoff"
      ? [
          "",
          "Mandatory for send_referencing_handoff: the JSON includes **sent**. Your reply MUST match sent: if false, do not say the email was delivered, resent, or received by the agency; use the **message** field. Never include **tenancy_id** in user-facing text — use **tenant_name** (and **property_address** if present).",
        ]
      : []
  return [
    "Tool output (internal data for you only):",
    "",
    `Summarize for the landlord with this focus: ${focus}`,
    ...qualifyExtra,
    ...onboardingExtra,
    ...referencingHandoffExtra,
    "",
    raw,
    "",
    "Do not repeat this as JSON, code, or key-value dumps in your reply. Translate into clear sentences and bullets per your system instructions.",
  ].join("\n")
}
