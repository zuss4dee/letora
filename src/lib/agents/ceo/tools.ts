import type Anthropic from "@anthropic-ai/sdk"
export type CEOToolName =
  | "chase_rent"
  | "get_maintenance_summary"
  | "get_leads_summary"
  | "get_pending_approvals_summary"
  | "search_properties"
  | "create_tenant_and_tenancy"
  | "start_tenant_onboarding"
  | "bulk_onboard_tenants"
  | "send_referencing_handoff"
  | "prepare_referencing"
  | "dispatch_maintenance_request"
  | "generate_property_listing"
  | "qualify_leads"
  | "nurture_lead"
  | "decide_lead_application"
  | "draft_contract"
  | "send_contract"
  | "get_contracts"
  | "send_move_in_email"
  | "get_dashboard_summary"
  | "get_compliance_summary"
  | "get_rent_status"
  | "list_tenants"
  | "resolve_onboarding_navigation"

export const CEO_TOOL_NAMES: readonly CEOToolName[] = [
  "chase_rent",
  "get_maintenance_summary",
  "get_leads_summary",
  "get_pending_approvals_summary",
  "search_properties",
  "create_tenant_and_tenancy",
  "start_tenant_onboarding",
  "bulk_onboard_tenants",
  "send_referencing_handoff",
  "prepare_referencing",
  "dispatch_maintenance_request",
  "generate_property_listing",
  "qualify_leads",
  "nurture_lead",
  "decide_lead_application",
  "draft_contract",
  "send_contract",
  "get_contracts",
  "send_move_in_email",
  "get_dashboard_summary",
  "get_compliance_summary",
  "get_rent_status",
  "list_tenants",
  "resolve_onboarding_navigation",
]

export function isCEOToolName(name: string): name is CEOToolName {
  return (CEO_TOOL_NAMES as readonly string[]).includes(name)
}
export const CEO_TOOLS: Anthropic.Tool[] = [
  {
    name: "chase_rent",
    description:
      "Run the rent chaser for a month: **drafts** overdue-tenant chase emails and records agent runs. Tenant chase emails are **approval-gated** — they appear in **Approvals** and send only after the landlord approves (check per-result **email_sent**). Does **not** collect rent or move money.",
    input_schema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "The month to chase rent for in YYYY-MM format. Defaults to current month if not provided.",
        },
        tenant_name: {
          type: "string",
          description:
            "When the user asked to chase a **specific tenant** (e.g. “Sofia Martins”), pass their full name so only that tenant’s overdue instalments in the month are drafted — not every overdue tenant.",
        },
        tenant_id: {
          type: "string",
          description: "Tenant profile UUID from list_tenants when known; scopes the chase to that tenant only.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_maintenance_summary",
    description:
      "Repairs and maintenance tickets only (plumbing, boiler, leaks, etc.). Do **not** use this alone for legal certificate questions — use **get_compliance_summary** for EPC, Gas Safety, Electric Safety / EICR. Get a summary of open, in-progress, and urgent maintenance tickets across all properties.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["open", "in_progress", "urgent", "all"],
          description: "Filter by status. Defaults to all.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_leads_summary",
    description:
      "Read-only lead overview: count new/pending/qualified/disqualified leads and list recent lead records. Does not change lead statuses.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_pending_approvals_summary",
    description:
      "Read-only snapshot of the landlord’s **Approvals** queue: pending human gates before outbound comms or contractor email. Use when the user asks to **list/show/review pending approvals**, what’s **in Approvals**, or the **approval queue** — not when they ask to **approve/send** a specific item from chat. Returns counts by category, oldest-waiting age, and item titles; execution stays in **/dashboard/approvals**.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "search_properties",
    description:
      "Find properties by address fragments, postcode, city, or full property UUID. Always use this before passing property_id to other tools — never guess a property id from a flat/unit number alone.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search text (e.g. “Apartment 706 Salford M3 7GX”) or a property UUID. Tokens are matched against address, city, and postcode.",
        },
        limit: {
          type: "number",
          description: "Max candidates to return (default 15, max 30).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_tenant_and_tenancy",
    description:
      "Create a brand-new tenant and tenancy from chat, then start onboarding on that tenancy. Use this when the user asks to onboard a new tenant and no tenant profile exists yet. Idempotent: reuses an existing tenant by email/name when uniquely matched, and reuses an existing active tenancy for that tenant+property instead of duplicating rows. If required fields are missing or property matches are ambiguous, the tool returns a minimal blocker with exactly what to ask next.",
    input_schema: {
      type: "object",
      properties: {
        tenant_name: {
          type: "string",
          description: "Tenant full name.",
        },
        tenant_email: {
          type: "string",
          description: "Tenant email address used for onboarding communications.",
        },
        property_id: {
          type: "string",
          description: "Property UUID from search_properties or prior context.",
        },
        property_query: {
          type: "string",
          description:
            "Address/city/postcode text when property_id is unknown. The tool resolves a unique property or returns candidates.",
        },
        start_date: {
          type: "string",
          description: "Tenancy start date in YYYY-MM-DD format.",
        },
        monthly_rent: {
          type: "string",
          description: "Monthly rent amount (e.g. 1850).",
        },
      },
      required: [],
    },
  },
  {
    name: "start_tenant_onboarding",
    description:
      "Start onboarding for an **existing** tenant/tenancy: (1) **onboarding_for** — tenant’s full name (plain English; server resolves tenant + tenancy), (2) tenancy_id, (3) tenant_id + property_id + start_date, or (4) lead_id + auto_create_tenant_and_tenancy. If multiple tenancies exist, use onboarding_property_hint or tenancy_id from list_tenants. For a **brand-new tenant + tenancy** from chat, prefer **create_tenant_and_tenancy**.",
    input_schema: {
      type: "object",
      properties: {
        onboarding_for: {
          type: "string",
          description:
            "Start onboarding for this tenant by **name** (e.g. “Alexis Dami”) — no UUIDs. Resolves the tenant profile and their tenancy/tenancies on this account. Prefer this when the user speaks in plain English.",
        },
        onboarding_property_hint: {
          type: "string",
          description:
            "Optional street or city substring if the tenant has more than one tenancy — narrows to one property before starting.",
        },
        tenancy_id: {
          type: "string",
          description: "Existing tenancy UUID to start onboarding for.",
        },
        tenant_id: {
          type: "string",
          description:
            "Existing tenant profile: exact UUID from list_tenants (preferred), or a distinctive full name if it matches exactly one tenant on the account. Do not combine with lead_id.",
        },
        lead_id: {
          type: "string",
          description: "Lead UUID to onboard from when using lead conversion.",
        },
        property_id: {
          type: "string",
          description:
            "Property UUID from search_properties — required with tenant_id+start_date, or when creating from lead if lead has no property.",
        },
        auto_create_tenant_and_tenancy: {
          type: "boolean",
          description: "If true and tenancy_id is missing, create tenant + tenancy from lead details.",
        },
        start_date: {
          type: "string",
          description: "Tenancy start date YYYY-MM-DD when creating a tenancy (tenant+property or lead path).",
        },
      },
      required: [],
    },
  },
  {
    name: "bulk_onboard_tenants",
    description:
      "Batch onboard many tenancies at once from a single CSV or list of rows. One row per tenancy. Creates property + tenant + tenancy records as needed and kicks off the tenant-onboarding agent (welcome email, 8 onboarding tasks) for each row. Idempotent: rows that already have an active tenancy are skipped, not duplicated. **Preview only when `preview=true`**; actual writes need user confirmation. Use when the user says things like 'import tenants', 'onboard these 20', 'bulk upload tenants', or pastes a CSV in chat.",
    input_schema: {
      type: "object",
      properties: {
        csv_text: {
          type: "string",
          description:
            "CSV (or TSV) text with header row. Required columns: property_address, tenant_name, tenant_email, monthly_rent, start_date. Optional: city, postcode, tenant_phone, move_in_date, end_date, deposit_amount. Max 100 rows.",
        },
        preview: {
          type: "boolean",
          description:
            "When true, only classifies rows (new vs matched vs error vs skip) and returns a preview — no writes. Default false — the tool writes after user confirmation.",
        },
      },
      required: ["csv_text"],
    },
  },
  {
    name: "send_referencing_handoff",
    description:
      "Email the landlord’s referencing agency a structured handoff (tenant + property + LETORA_REF) — same as Tenancy → Send referencing handoff. Requires a default agency email in Settings or a per-tenancy override. Pass **tenancy_id** when known; otherwise **tenant_id** (profile UUID) or **tenant_name** to resolve the tenancy.",
    input_schema: {
      type: "object",
      properties: {
        tenancy_id: {
          type: "string",
          description: "Tenancy UUID (preferred when known).",
        },
        tenant_id: {
          type: "string",
          description: "Tenant profile UUID from list_tenants when tenancy_id is unknown.",
        },
        tenant_name: {
          type: "string",
          description: "Tenant full name when tenancy_id is unknown (e.g. from the user’s message).",
        },
      },
      required: [],
    },
  },
  {
    name: "prepare_referencing",
    description:
      "Read-only: check referencing setup for a tenancy (agency email in Settings or tenancy override), onboarding_status, handoff timestamps, checklist tasks, and **recent inbound mail rows** from the database for that tenancy. Pass **tenancy_id**, or **tenant_id** (profile UUID), or **tenant_name** (same resolution as send_referencing_handoff). Use before send_referencing_handoff when guiding next steps.",
    input_schema: {
      type: "object",
      properties: {
        tenancy_id: {
          type: "string",
          description: "Tenancy UUID to check.",
        },
        tenant_id: {
          type: "string",
          description: "Tenant profile UUID (from list_tenants) if tenancy_id is unknown.",
        },
        tenant_name: {
          type: "string",
          description: "Tenant full name when tenancy_id is unknown (e.g. Alexis Adeosun).",
        },
      },
      required: [],
    },
  },
  {
    name: "dispatch_maintenance_request",
    description:
      "Log and classify a maintenance issue. If **contractor_email** is set, contractor email is **approval-gated** (pending in **Approvals** until approved). Without contractor email, logs the ticket only — no contractor **sent**.",
    input_schema: {
      type: "object",
      properties: {
        tenancy_id: {
          type: "string",
          description: "Tenancy UUID for the issue location.",
        },
        issue_title: {
          type: "string",
          description: "Short issue title (e.g., leaking kitchen tap).",
        },
        issue_description: {
          type: "string",
          description: "Detailed issue description from tenant/manager.",
        },
        contractor_name: {
          type: "string",
          description: "Optional preferred contractor name.",
        },
        contractor_email: {
          type: "string",
          description: "Optional preferred contractor email.",
        },
        dispatch_channel: {
          type: "string",
          enum: ["email", "sms", "both"],
          description: "Dispatch target channel. Current implementation supports email.",
        },
      },
      required: ["tenancy_id", "issue_description"],
    },
  },
  {
    name: "generate_property_listing",
    description:
      "Generate polished UK-market listing copy from property data. Can preview only or save back to the property record.",
    input_schema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "Property UUID to generate listing copy for.",
        },
        tone: {
          type: "string",
          enum: ["premium", "family", "student", "investor"],
          description: "Optional marketing tone.",
        },
        target_channel: {
          type: "string",
          enum: ["rightmove", "zoopla", "generic"],
          description: "Optional target channel style.",
        },
        save_to_property: {
          type: "boolean",
          description: "If true, persist generated description to the property record.",
        },
      },
      required: ["property_id"],
    },
  },
  {
    name: "qualify_leads",
    description:
      "Run the lead qualifier on leads with qualified_status pending: scores each lead and persists qualified/disqualified status plus a short note on the lead row.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: {
          type: "string",
          description:
            "Optional UUID. When set, only score and update this lead (must be pipeline **new** and qualification **pending**).",
        },
      },
      required: [],
    },
  },
  {
    name: "nurture_lead",
    description:
      "For a qualified lead with an email address: advance the pipeline one step (new→contacted→viewing→applied), draft a professional follow-up email, save/send via email logs per auto-send settings, and update the lead status. Requires the correct current stage.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: {
          type: "string",
          description: "UUID of the lead row.",
        },
        step: {
          type: "string",
          enum: ["initial_contact", "viewing", "application"],
          description:
            "initial_contact (from new to contacted), viewing (from contacted to viewing), application (from viewing to applied).",
        },
      },
      required: ["lead_id", "step"],
    },
  },
  {
    name: "decide_lead_application",
    description:
      "Landlord decision on a lead in applied stage: set status to approved or rejected (human gate after application). Does not send email.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: {
          type: "string",
          description: "UUID of the lead row.",
        },
        decision: {
          type: "string",
          enum: ["approved", "rejected"],
          description: "Final outcome for this applicant.",
        },
      },
      required: ["lead_id", "decision"],
    },
  },
  {
    name: "draft_contract",
    description:
      "Draft a tenancy (AST) for a tenant and save a draft row in Contracts (review in /dashboard/contracts). Prefer tenancy_id from list_tenants or start_tenant_onboarding resume when available. Otherwise use tenant_name or tenant_id (tenant profile UUID from list_tenants). You may pass onboarding_property_hint alone (street or city substring) — the server resolves a unique tenancy on the account; combine with tenant_name when several tenancies could match.",
    input_schema: {
      type: "object",
      properties: {
        tenant_name: {
          type: "string",
          description: "Full name of the tenant (same resolution as onboarding — distinctive spelling).",
        },
        tenant_id: {
          type: "string",
          description: "Tenant profile UUID from list_tenants (not tenancy_id unless you also pass it as tenancy_id).",
        },
        tenancy_id: {
          type: "string",
          description:
            "Specific tenancy UUID when known (e.g. from start_tenant_onboarding resume or list_tenants nested tenancies) — avoids wrong tenant when several people share a name.",
        },
        onboarding_property_hint: {
          type: "string",
          description:
            "Street or city substring (e.g. “Billionaires Row”, postcode). Narrows when the tenant has multiple tenancies; can also resolve a unique tenancy when tenant_name is unknown if the hint matches one property on the account.",
        },
        override: {
          type: "boolean",
          description:
            "Set true only when the user explicitly asks to force or override referencing — drafts the contract even if referencing is not yet marked complete.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_dashboard_summary",
    description:
      "Portfolio snapshot: property and tenant counts, overdue rent, open **maintenance** tickets, and **compliance** counts from the compliance_records table (EPC, Gas Safety, Electric Safety) — not the same as repairs.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_compliance_summary",
    description:
      "Read-only: **Legal/safety certificates** per property from **compliance_records** (linked by property_id). Types: EPC, Gas Safety, Electric Safety (EICR). Use this when the user asks about compliance, certificates, EPC, gas safety, electrical safety, expiry, or legal safety — **before** relying on maintenance tickets. A **compliance issue** is expired or past expiry_date; a **gap** is status **missing** (no date yet).",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_rent_status",
    description:
      "Rent Tracker rows for the month **plus** authoritative tenancy records: monthly_rent, start_date, move_in_date, tenancy status, inferred rent due day from start_date, and earliest payment row. Pass **tenant_name** and/or **tenancy_id** when the user asks about a specific tenant’s rent, amount, first payment, due date, or schedule — answers must use **tenancies** from this JSON, not chat memory.",
    input_schema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "Month in YYYY-MM format. Defaults to current month.",
        },
        tenancy_id: {
          type: "string",
          description: "Scope to one tenancy UUID when known.",
        },
        tenant_name: {
          type: "string",
          description: "Resolve the tenancy by tenant full name (same account).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_tenants",
    description: "List tenants with optional filters by property or status.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "inactive", "all"],
          description: "Filter tenants by status. Defaults to active.",
        },
        property_id: {
          type: "string",
          description: "Optional property UUID to filter tenants by property.",
        },
      },
      required: [],
    },
  },
  {
    name: "resolve_onboarding_navigation",
    description:
      "Read-only: resolve a deep link to the tenancy onboarding screen (/dashboard/tenancies/[id]). Pass tenancy_id, or tenant_id (tenant profile UUID), or tenant_name. If nothing is specified or the tenant is ambiguous, the JSON explains what to ask the user.",
    input_schema: {
      type: "object",
      properties: {
        tenancy_id: {
          type: "string",
          description: "Tenancy UUID — opens that tenancy’s onboarding panel.",
        },
        tenant_id: {
          type: "string",
          description: "Tenant profile UUID — opens onboarding for that tenant’s tenancy when unique.",
        },
        tenant_name: {
          type: "string",
          description: "Tenant full name — resolves to tenant profile then tenancy (same as other tools).",
        },
      },
      required: [],
    },
  },
  {
    name: "send_contract",
    description:
      "Send a drafted contract to the tenant for signing via email. Updates the contract status to 'sent' and the tenancy onboarding_status to 'contract_sent'. Returns a unique signing URL for the tenant. If contract_id is not provided, auto-resolves the most recent draft contract for the given tenant_name or tenancy_id.",
    input_schema: {
      type: "object",
      properties: {
        contract_id: {
          type: "string",
          description: "The UUID of the contract to send. If omitted, the most recent draft contract for the tenant/tenancy is used.",
        },
        tenancy_id: {
          type: "string",
          description: "The UUID of the tenancy linked to this contract.",
        },
        tenant_name: {
          type: "string",
          description: "Tenant full name — used to auto-resolve the contract when contract_id is not provided.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_contracts",
    description:
      "Look up contracts for a tenant by name or tenancy_id. Returns contract status, signing state, and linked tenant/property details. Use this to find a contract_id before calling send_contract.",
    input_schema: {
      type: "object",
      properties: {
        tenant_name: {
          type: "string",
          description: "Full or partial tenant name to search contracts for.",
        },
        tenancy_id: {
          type: "string",
          description: "Tenancy UUID to filter contracts by.",
        },
      },
      required: [],
    },
  },
  {
    name: "send_move_in_email",
    description:
      "Queue move-in instructions email for a tenancy for landlord approval in Approvals. Pass **tenancy_id** or **tenant_name** to resolve the tenancy. After approval, the email sends via Resend and the checklist task **Send move-in instructions email** is marked complete.",
    input_schema: {
      type: "object",
      properties: {
        tenancy_id: {
          type: "string",
          description: "Tenancy UUID when known.",
        },
        tenant_name: {
          type: "string",
          description: "Tenant full name — used to resolve a unique tenancy when tenancy_id is omitted.",
        },
      },
      required: [],
    },
  },
]
