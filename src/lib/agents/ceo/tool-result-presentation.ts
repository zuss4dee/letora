import type { CEOToolName } from "./tools"

/**
 * Short hints so the model turns structured tool output into the right style of user-facing reply.
 */
const TOOL_SUMMARY_HINTS: Record<CEOToolName, string> = {
  chase_rent:
    "Summarise **month**, **chased** count, and **message**. Use this shape: **current finding** → **notable exception(s)** → **next action**. For each **results** row: use **email_sent** — if false, say **drafted** / **pending approval** (not **sent**); if true, say **sent** for that row. Critical anti-contradiction rule: when **chased = 0**, never use blanket wording like “no overdue rent found” if any other tool data in this turn indicates overdue tenancies/payments. Instead say: no **bulk** chase set was created for the month, but one or more tenancies appear overdue and could be chased individually. If no draft has been created yet, ask explicitly: “Would you like me to draft a rent chase for <tenant>?” Do not imply a draft/sent state unless JSON confirms it. When ranking rows for urgency: use **days_overdue** and **amount_owed** only when present; **email_sent** false before true for “what first”; flag missing/blank **tenant_email** as a **blocker** before chase priority. If **multiple** rows share the same missing field or same **pending approval** state, you may add one hedged **pattern to watch** line for **this snapshot only** — no historical trend language. Direct to **/dashboard/approvals** when any row is not sent. Do not imply Letora collected rent.",
  get_maintenance_summary:
    "Order by **priority** (urgent first when field exists), then non-completed **status**, then **created_at** if present in ticket objects. Lead with the single worst ticket for tenant impact when JSON supports it; do not invent severity beyond **priority** / title / description text. If many tickets are open with a **common** theme visible in titles/status (e.g. same property or same category) **only** from JSON text, you may note a **pattern to watch** in one cautious sentence — not a trend over time. Summarize the most important tickets by title; do not list raw IDs.",
  get_leads_summary:
    "State whether there are any new leads, then give pending/qualified/disqualified counts and a short list of recent lead names when helpful.",
  search_properties:
    "List matching properties with their **id** (UUID), human-readable label, and hint if multiple matches — tell the user to pick the right one before mutating tools. Never treat a unit number as a UUID.",
  create_tenant_and_tenancy:
    "Use operational create-flow wording. Structure as: **Created**, **Drafted**, **Pending approval**, **Blocked**, **Next action** (omit empty sections). If **created_tenant** true say **Created tenant record**; if **created_tenancy** true say **Created tenancy**; if reused flags are true, say reused existing record(s) instead of created. If onboarding result shows email draft/approval, keep send claims truthful: only **sent** when JSON confirms. For **blocked_by** arrays, ask only for the smallest missing field and do not send broad dashboard/manual instructions. For **property_ambiguous**, present **candidates** cleanly and ask for one confirmation.",
  start_tenant_onboarding:
    "Structure blocked/create replies as: Ready to create — Blocked by — What I already have — Next action (plus Created/Drafted/Pending approval when applicable). Ask for the **minimum blocker only** from JSON fields like **blocked_by**, **missing_fields**, or explicit **code**. Examples: if only tenant email is missing, ask only for email; if property is ambiguous, show clean **candidates** and ask for one confirmation; if start date/rent format is invalid, ask only for corrected normalized value (YYYY-MM-DD for dates). Avoid long manual dashboard instructions unless unavoidable. **Created:** include **Created tenant record**, **Created tenancy**, and explicit **Created property record** when JSON indicates each happened. **Drafted/Pending approval:** welcome email is drafted/pending approval unless JSON confirms **emailStatus: sent**. **Blocked:** state one operational blocker in plain language without exposing internal limitations. **Next action:** exactly one next step. If **mode** is **resume**, follow **ceo_resume_hint** and **pending_task_names**; when **referencing_complete** is true, do not claim referencing is pending.",
  bulk_onboard_tenants:
    "If **mode** is **preview**, summarize **summary.total**, **summary.newProperties**, **summary.matchedProperties**, **summary.existingTenants**, **summary.skippedActiveTenancies**, **summary.validationErrors**, and call out a few **preview_rows**. Ask the user to confirm before running the real import. If **mode** is **executed**, lead with **totals.succeeded / totals.total** onboarded, plus **totals.skipped** and **totals.failed**; mention tenants get welcome emails + onboarding tasks. If **mode** is **nothing_to_do**, repeat the **note** and suggest fixing the CSV or removing duplicates. Never paste raw JSON.",
  send_referencing_handoff:
    "Read **sent** (boolean) and **message**. Use **tenant_name** / **property_address** when describing who the handoff was for. Do **not** quote **tenancy_id** in prose. If sent is true, confirm the email was sent to the agency. If sent is false, say what happened per **message** — never claim the email was sent unless sent is true.",
  prepare_referencing:
    "Follow **ceo_instruction** verbatim for what to say about inbound mail. Summarize **recent_inbound_mail** previews when present. **onboarding_status**, **referencing_complete**, **handoff_sent**, **referencing_last_inbound_at**, **tasks** / **tasks_complete**/**tasks_total**. Prefer calling out **missing_agency_email** or stalled handoff before generic task progress when JSON shows a blocker. If missing_agency_email, point to Settings → Email & Automation (referencing). If handoff_sent is true, do not imply the user still needs to send the first handoff.",
  dispatch_maintenance_request:
    "Read **contractor_dispatch** / **channel_note**. If **pending_approval** or message says Approvals, say dispatch is **pending approval** (not **sent**); if only logged with no contractor email, say **completed** for logging, no contractor email **sent**. If **error** in JSON, say **blocked** and why.",
  generate_property_listing:
    "Share polished listing copy summary and whether it was saved to the property record or returned as preview only.",
  qualify_leads:
    "If the JSON has error/details, lead with that in plain language. If message says no pending leads, say so. If parse_ok is false or parse_failed is true, explain briefly and use hint + /dashboard/leads — never generic 'technical failure' boilerplate. Otherwise: how many scored, outcomes, reasons in prose (not raw JSON).",
  nurture_lead:
    "Confirm pipeline step and new status. Say **sent** only if the tool JSON indicates send; otherwise **drafted** or saved per **message** / settings — not **pending approval** unless JSON says so.",
  decide_lead_application:
    "State clearly whether the applicant was approved or rejected and that the lead record was updated.",
  draft_contract:
    "Read **saved**, **contract_id**, **property_match**, **message**, **error**, and **code**. If **code** is **llm_error** or **save_failed**, repeat the **error** string in plain language — do **not** blame “tenant record resolution”, “backend configuration”, “synchronization”, or “sync” unless those exact words appear in **error**. If **code** is **matched_by_fallback**, ask if the property in **message** is the right one. If **code** is **ambiguous_match**, list **candidates** and ask which address they mean. If **code** is **no_property_match**, use **message** in plain language. If **code** is **ambiguous_tenancy**, **multiple_tenants**, or **tenant_name_mismatch**, list **candidates** and ask the user to pick — do **not** say the tenancy does not exist at that address. If **saved** is true, say the **tenancy agreement** draft was **saved** (**proposed** / ready for review — not tenant **sent** until **send_contract** succeeds). Mention review under **/dashboard/contracts**. **tenancy_id** may be omitted when the draft matched tenant + property without a separate tenancy row. Do not paste internal instructions, “Next steps”, or raw URLs. Do not paste the full document unless asked.",
  send_contract:
    "Read **success** and **message**. If success is true, the signing email to the tenant was **sent** (signing link) — not payment collection. If success is false, say **blocked** or failed and use **message** / **error**.",
  get_contracts:
    "List rows found: for each, mention tenant name, property address, status (draft/sent/signed/active), and contract_id. In prose say **tenancy agreement**, not “contract”, unless quoting data. If none found, say so and suggest drafting one first.",
  send_move_in_email:
    "If **pending_approval** is true (normal path), say move-in instructions are **proposed** and **pending approval** in **/dashboard/approvals** — not **sent** until executed. If **success** is false, say **blocked** and use **message**. Only say **sent** if JSON explicitly confirms send with no approval gate.",
  get_dashboard_summary:
    "Give a compact portfolio snapshot: property and tenant counts, overdue rent pressure, maintenance load, **compliance_issue_count**, **compliance_gap_count** (missing expiry / undated certs), **compliance_expiring_soon_count** from the JSON (legal certificates — not repairs). Within **compliance_issues_preview**, prefer expired / clear issues over expiring-soon when ranking “worst first” — only for rows shown; note previews may be capped. For “what next?”: lead with one highest-severity line backed by numbers, say **why** in one sentence from JSON, then **/dashboard/approvals** for approval-gated comms (do not invent approval row counts or ages). If **several** preview rows show the **same** certificate type gap or same property, you may add one hedged **pattern to watch** for **this** summary only — never imply weeks/months of history.",
  get_compliance_summary:
    "Lead with **compliance_issue_count** and **compliance_gap_count**. Within **records**, list true compliance issues (expired or expiry before today) before gaps when ranking “fix first” — only using **is_compliance_issue**, **is_compliance_gap**, **expiry_date**, **status** from JSON. Mention **expiring_within_30_days_count** separately. Do not confuse with maintenance tickets — **definition** in the JSON explains the rule.",
  get_rent_status:
    "Prioritize **tenancies** in the JSON: monthly_rent, start_date, move_in_date, tenancy_status, rent_due_day_of_month, rent_schedule_hint, first_payment_record. Use **payments** for that month’s paid/overdue. When several payments are overdue in JSON, rank by **due_date** then **amount** only if those fields exist — otherwise say ordering is unclear. If **multiple** overdue rows share the same tenancy/property signal from JSON, one optional hedged **pattern to watch** line is allowed — current data only. Never say you lack rent amount or tenancy start date when **tenancies** includes them. If **ambiguity_note** is set, follow it.",
  list_tenants:
    "Give the count and a short bullet list of names (and property if clear); avoid dumping the full table.",
  resolve_onboarding_navigation:
    "For next-step onboarding questions, use this read-first shape: **current stage** → **completed steps** → **blocker (if any)** → **next valid action**. If ok=true, rely on **pending_task_names**, **referencing_complete**, **tasks_complete**/**tasks_total** only — do not invent a generic checklist. Distinguish human gates from automation: if the next step is approval-gated, say the landlord must approve in **/dashboard/approvals**; after that, say workflow progression continues automatically as requirements/statuses complete. Avoid wording that implies they must manually work through every checklist item. Prefer: “Open onboarding to view status.” and “You do not need to manually advance each step; Approvals is only needed for gated actions.” If **referencing_complete** is true, do not claim referencing is pending. Offer execution only after the landlord explicitly says proceed. Give the **Open onboarding** button (UI). If needs_tenant or multiple_tenants, ask which tenant or use chips. If multiple_tenancies, ask them to pick the right property. Do not paste raw JSON.",
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
          "Mandatory for start_tenant_onboarding: never mention a tenant portal, tenant app, or tenant login. Do **not** emit `<action …/>` tags; the UI supplies **Open onboarding** from tool JSON when **tenancy_id** is present. Never claim the welcome email was **sent** unless **emailStatus** / JSON confirms send.",
        ]
      : []
  const createTenantTenancyExtra =
    toolName === "create_tenant_and_tenancy"
      ? [
          "",
          "Mandatory for create_tenant_and_tenancy: when **blocked_by** exists, ask only for those missing field(s) — do not give broad manual dashboard instructions. If **property_ambiguous**, present concise candidate labels and ask for one confirmation. If records were reused (**reused_tenant** / **reused_tenancy**), say reused instead of created.",
        ]
      : []
  const referencingHandoffExtra =
    toolName === "send_referencing_handoff"
      ? [
          "",
          "Mandatory for send_referencing_handoff: the JSON includes **sent**. Your reply MUST match sent: if false, do not say the email was delivered, resent, or received by the agency; use the **message** field. Never include **tenancy_id** in user-facing text — use **tenant_name** (and **property_address** if present).",
        ]
      : []
  const chaseRentExtra =
    toolName === "chase_rent"
      ? [
          "",
          "Mandatory for chase_rent: use **email_sent** per **results** row. False means **drafted** / **pending approval** (not **sent**). If **chased=0**, phrase it as “no bulk chase set for the month” (not “no overdue rent found”) when any turn data still shows overdue rows. If an individual overdue exception exists and no draft exists yet, ask whether to draft a chase for that tenant. Rank within **results** using **days_overdue** / **amount_owed** only when present; flag blank **tenant_email** as blocker before urgency. The batch **message** already states Approvals — reinforce **/dashboard/approvals** when chases are not sent. Never imply tenant payment was collected.",
        ]
      : []
  return [
    "Tool output (internal data for you only):",
    "",
    `Summarize for the landlord with this focus: ${focus}`,
    ...qualifyExtra,
    ...onboardingExtra,
    ...createTenantTenancyExtra,
    ...referencingHandoffExtra,
    ...chaseRentExtra,
    "",
    raw,
    "",
    "Do not repeat this as JSON, code, or key-value dumps in your reply. Translate into clear sentences and bullets per your system instructions.",
  ].join("\n")
}
