import type { ToolUseBlock } from "@anthropic-ai/sdk/resources/messages/messages"

import type { CEOToolName } from "./tools"
import { isCEOToolName } from "./tools"

type CEOMessageLike = { role: "user" | "assistant"; content: string }

export type CEOIntent = "read_only" | "draft_suggest" | "confirmation_required"

/** In-session pending tool batch (client resends with confirmedExecution). */
export type PendingCEOAction = {
  v: 1
  toolCalls: readonly { name: CEOToolName; input: Record<string, string> }[]
}

const READ_ONLY_TOOLS: readonly CEOToolName[] = [
  "get_dashboard_summary",
  "get_rent_status",
  "get_maintenance_summary",
  "get_leads_summary",
  "search_properties",
  "list_tenants",
  "prepare_referencing",
  "resolve_onboarding_navigation",
]

function isReadOnlyTool(name: CEOToolName): boolean {
  return (READ_ONLY_TOOLS as readonly string[]).includes(name)
}

export function getLatestUserContent(messages: readonly CEOMessageLike[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content
  }
  return ""
}

/**
 * Lightweight intent routing: read vs draft vs actions that need explicit confirmation.
 */
export function classifyCEOIntent(latestUserText: string): CEOIntent {
  const t = latestUserText.trim().toLowerCase()
  if (t.length === 0) return "read_only"

  if (
    /\b(send|resend|dispatch|onboard|start\s+onboarding|blast|transmit|actually\s+send|go\s+ahead\s+and\s+send|email\s+them\s+now|mark\s+.*\s+resolved|mark\s+as\s+resolved|close\s+the\s+tickets?|delete\s+|remove\s+permanently|cancel\s+the\s+|finalize\s+and\s+send)\b/.test(
      t,
    )
  ) {
    return "confirmation_required"
  }

  /** Avoid “list/show my leads and qualify” being classified read_only. */
  if (/\bqualify\b/.test(t) && /\bleads?\b/.test(t)) {
    return "draft_suggest"
  }

  /**
   * “What’s next” / next steps are action-oriented — must not force confirmation on
   * draft_contract / start_tenant_onboarding (otherwise the model often end_turns with generic advice).
   */
  if (
    /\b(next\s+step|next\s+thing|what'?s\s+next|what\s+to\s+do\s+next|what\s+do\s+i\s+do\s+next|what\s+should\s+i\s+do\s+next|what'?s\s+left|what\s+else\s+to\s+do|remaining\s+tasks?|continue\s+with|check\s+the\s+tenancy|look\s+up\s+the\s+tenancy)\b/i.test(
      t,
    )
  ) {
    return "draft_suggest"
  }

  if (
    /\b(how\s+many|how\s+much|list|show\s+me|what('s|s| is)|status|summary|overview|dashboard|breakdown|who\s+(has|is|are)|total|count|any\s+overdue|do\s+i\s+have|tell\s+me\s+about)\b/.test(
      t,
    )
  ) {
    return "read_only"
  }

  if (
    /\b(draft|prepare|suggest|outline|write\s+(me\s+)?(a\s+)?|create\s+a\s+draft|generate\s+a)\b/.test(t)
  ) {
    return "draft_suggest"
  }

  return "draft_suggest"
}

/**
 * Non–read-only tools need explicit confirmation unless the user is in draft/suggest mode.
 * Onboarding (`start_tenant_onboarding`) stays behind confirmation when the user message
 * triggers `confirmation_required` (e.g. says “onboard”) — plan: safer default (A).
 */
export function toolsRequireUserConfirmation(
  intent: CEOIntent,
  toolNames: readonly CEOToolName[],
): boolean {
  const mutating = toolNames.filter((n) => !isReadOnlyTool(n))
  if (mutating.length === 0) return false
  if (intent === "draft_suggest") return false
  /** Same UX as Agents → Lead Qualifier: qualify without an extra confirmation step. */
  if (mutating.length === 1 && mutating[0] === "qualify_leads") return false
  return true
}

export function isAffirmativeConfirmation(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t === "y") return true
  return /^(yes|yep|yeah|yup|sure|ok|okay|confirm|confirmed|do\s+it|go\s+ahead|proceed|please\s+do)\b/.test(
    t,
  )
}

/**
 * Coerce model tool input to string values so `.trim()` and string APIs never throw
 * (Anthropic sometimes returns booleans/numbers).
 */
export function normalizeCEOToolInput(input: unknown): Record<string, string> {
  if (typeof input !== "object" || input === null) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue
    out[k] = typeof v === "string" ? v : JSON.stringify(v)
  }
  return out
}

export function pendingActionFromToolUseBlocks(blocks: readonly ToolUseBlock[]): PendingCEOAction {
  const toolCalls = blocks.map((b) => {
    const name = b.name
    if (!isCEOToolName(name)) {
      throw new Error(`Unsupported tool in pending action: ${name}`)
    }
    return { name, input: normalizeCEOToolInput(b.input) }
  })
  return { v: 1, toolCalls }
}

/** Removes hex UUIDs and "(tenancy …)" fragments so chat never shows raw tenancy ids. */
export function stripCeoHexUuidsFromText(text: string): string {
  let t = text;
  t = t.replace(/\(\s*tenancy\s+[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\s*\)/gi, "");
  t = t.replace(/\(\s*tenancy\s+[0-9a-f-]{36}\s*\)/gi, "");
  t = t.replace(
    /\(\s*tenancy\s*(?:id)?\s*:\s*[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\s*\)/gi,
    "",
  );
  t = t.replace(
    /\btenancy\s*(?:id)?\s*:\s*[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi,
    "",
  );
  // Do not strip UUIDs in /dashboard/tenancies/<id> (link chips / deep links).
  t = t.replace(/(?<!\/tenancies\/)\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, "");
  t = t.replace(/\(\s*\)/g, "");
  t = t.replace(/\*{2}\s*\*{2}/g, "");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

export function buildConfirmationMessage(action: PendingCEOAction): string {
  const lines = action.toolCalls.map((c) => {
    switch (c.name) {
      case "chase_rent":
        return `• **Chase overdue rent** (prepare/send tenant communications${
          c.input.month ? ` for **${c.input.month}**` : ""
        })`
      case "draft_contract":
        return `• **Draft a tenancy contract**${
          c.input.tenant_name ? ` for **${c.input.tenant_name}**` : ""
        }`
      case "qualify_leads":
        return "• **Qualify pending leads** (score and recommend follow-up)"
      case "nurture_lead":
        return `• **Nurture a lead** (advance pipeline step${c.input.lead_id ? ` for lead **${c.input.lead_id.slice(0, 8)}…**` : ""}${c.input.step ? ` — **${c.input.step}**` : ""}; may draft/send email)`
      case "decide_lead_application":
        return `• **Approve or reject applicant** (final decision on a lead in applied stage${c.input.decision ? ` — **${c.input.decision}**` : ""})`
      case "start_tenant_onboarding":
        return `• **Start tenant onboarding**${
          c.input.onboarding_for ? ` for **${c.input.onboarding_for}**` : ""
        } (may create tenancy records, checklist tasks, and welcome communications)`
      case "send_referencing_handoff": {
        const tn = c.input.tenant_name?.trim()
        if (tn) {
          return `• **Send referencing handoff to agency** for **${tn}** (drafts or sends email to your referencing provider)`
        }
        return `• **Send referencing handoff to agency** for the tenant you mean (drafts or sends email to your referencing provider)`
      }
      case "prepare_referencing":
        return `• **Check referencing setup** (read-only — agency email, onboarding stage, checklist progress)`
      case "resolve_onboarding_navigation":
        return "• **Resolve onboarding screen link** (read-only — deep link to tenancy onboarding)"
      case "dispatch_maintenance_request":
        return "• **Dispatch maintenance request** (logs issue and may notify contractor)"
      case "generate_property_listing":
        return "• **Generate property listing** (can save generated marketing description to property record)"
      case "get_maintenance_summary":
        return "• **Summarise maintenance tickets** (read-only)"
      case "get_leads_summary":
        return "• **Leads pipeline summary** (read-only)"
      case "get_dashboard_summary":
        return "• **Portfolio dashboard summary** (read-only)"
      case "get_rent_status":
        return `• **Rent status breakdown**${
          c.input.month ? ` for **${c.input.month}**` : ""
        } (read-only)`
      case "list_tenants":
        return "• **List tenants** (read-only)"
      case "search_properties":
        return "• **Search properties** (read-only — resolve address to property UUIDs)"
      default:
        return `• **${(c as { name: string }).name}**`
    }
  })

  const hasReferencingSend = action.toolCalls.some((c) => c.name === "send_referencing_handoff");
  const intro = hasReferencingSend
    ? `The next step will **email your referencing agency** with tenant and property details from Letora (same as the tenancy page handoff):\n\n`
    : `The next step may **contact tenants** or **change what they see**, or run actions that go beyond a simple lookup:\n\n`;

  return stripCeoHexUuidsFromText(
    `${intro}${lines.join("\n")}\n\nReply **yes** to proceed, or tell me what to change.`,
  )
}

const MAX_PENDING_TOOL_CALLS = 8

export function parsePendingCEOActionFromJson(value: unknown): PendingCEOAction | null {
  if (typeof value !== "object" || value === null) return null
  const o = value as Record<string, unknown>
  if (o.v !== 1) return null
  if (!Array.isArray(o.toolCalls)) return null
  if (o.toolCalls.length === 0 || o.toolCalls.length > MAX_PENDING_TOOL_CALLS) return null

  const toolCalls: { name: CEOToolName; input: Record<string, string> }[] = []
  for (const c of o.toolCalls) {
    if (typeof c !== "object" || c === null) return null
    const row = c as Record<string, unknown>
    if (typeof row.name !== "string" || !isCEOToolName(row.name)) return null
    if (typeof row.input !== "object" || row.input === null) return null
    const inputRec: Record<string, string> = {}
    for (const [k, v] of Object.entries(row.input as Record<string, unknown>)) {
      if (typeof v !== "string") return null
      inputRec[k] = v
    }
    toolCalls.push({ name: row.name, input: inputRec })
  }

  return { v: 1, toolCalls }
}
