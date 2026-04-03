import type Anthropic from "@anthropic-ai/sdk"
export type CEOToolName =
  | "chase_rent"
  | "get_maintenance_summary"
  | "get_leads_summary"
  | "search_properties"
  | "start_tenant_onboarding"
  | "send_referencing_handoff"
  | "prepare_referencing"
  | "dispatch_maintenance_request"
  | "generate_property_listing"
  | "qualify_leads"
  | "nurture_lead"
  | "decide_lead_application"
  | "draft_contract"
  | "get_dashboard_summary"
  | "get_rent_status"
  | "list_tenants"
  | "resolve_onboarding_navigation"

export const CEO_TOOL_NAMES: readonly CEOToolName[] = [
  "chase_rent",
  "get_maintenance_summary",
  "get_leads_summary",
  "search_properties",
  "start_tenant_onboarding",
  "send_referencing_handoff",
  "prepare_referencing",
  "dispatch_maintenance_request",
  "generate_property_listing",
  "qualify_leads",
  "nurture_lead",
  "decide_lead_application",
  "draft_contract",
  "get_dashboard_summary",
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
      "Chase overdue and past-due rent using the same pipeline as the Rent Tracker agent: drafts/sends emails via email logs per user auto-send settings, and records agent runs.",
    input_schema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "The month to chase rent for in YYYY-MM format. Defaults to current month if not provided.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_maintenance_summary",
    description: "Get a summary of all open, in-progress, and urgent maintenance tickets across all properties.",
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
    name: "start_tenant_onboarding",
    description:
      "Start onboarding: (1) **onboarding_for** — tenant’s full name (plain English; the server resolves tenant + tenancy). **Always use this when the user gives a person’s name** — never tell them UUIDs are required first. (2) tenancy_id, (3) tenant_id + property_id + start_date, or (4) lead_id + auto_create_tenant_and_tenancy. If multiple tenancies exist, use onboarding_property_hint or tenancy_id from list_tenants.",
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
      "Log a new maintenance issue, classify severity/category, and optionally assign + draft/send contractor communication.",
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
      "Draft a tenancy (AST) for a tenant by name or ID and save a draft row in Contracts with the generated text (review in /dashboard/contracts).",
    input_schema: {
      type: "object",
      properties: {
        tenant_name: {
          type: "string",
          description: "The full name of the tenant to draft the contract for.",
        },
        tenant_id: {
          type: "string",
          description: "The UUID of the tenant if known.",
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
    description: "Get a full overview of the landlord's portfolio including property count, tenant count, overdue rent, and open maintenance issues.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_rent_status",
    description: "Get a detailed breakdown of rent payments — who has paid, who is overdue, and total amounts.",
    input_schema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "Month in YYYY-MM format. Defaults to current month.",
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
]
