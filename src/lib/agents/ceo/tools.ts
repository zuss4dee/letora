import type Anthropic from "@anthropic-ai/sdk"
export type CEOToolName =
  | "chase_rent"
  | "get_maintenance_summary"
  | "qualify_leads"
  | "draft_contract"
  | "get_dashboard_summary"
  | "get_rent_status"
  | "list_tenants"

export const CEO_TOOL_NAMES: readonly CEOToolName[] = [
  "chase_rent",
  "get_maintenance_summary",
  "qualify_leads",
  "draft_contract",
  "get_dashboard_summary",
  "get_rent_status",
  "list_tenants",
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
    name: "qualify_leads",
    description:
      "Run the lead qualifier on leads with qualified_status pending: scores each lead and persists qualified/disqualified status plus a short note on the lead row.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
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
]
