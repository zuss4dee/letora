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
  "get_compliance_summary",
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

/**
 * Cheap CSV row counter for the confirmation preview — strips header + blank lines.
 * Does NOT try to validate the schema; `bulk_onboard_tenants` executor does that.
 */
function countCsvRows(csvText: string): number {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length <= 1) return 0
  return lines.length - 1
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

  /** New tenant + tenancy creation from freeform — must get normalized confirmation before tools run. */
  if (
    (/\b(create|add|set\s+up)\b/.test(t) && /\b(tenant|tenancy)\b/.test(t)) ||
    (/\bonboard\b/.test(t) && /\bcreate\b/.test(t) && /\btenancy\b/.test(t))
  ) {
    return "confirmation_required"
  }

  /** Read-first onboarding state checks should not immediately trigger mutating confirmation UX. */
  if (
    /\b(next\s+onboarding\s+action|what\s+stage\s+is|what\s+is\s+blocking|what'?s\s+blocking|what'?s\s+left|remaining\s+onboarding|continue\s+.*onboarding|resume\s+.*onboarding)\b/.test(
      t,
    )
  ) {
    return "draft_suggest"
  }

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
    /\b(how\s+many|how\s+much|list|show\s+me|what('s|s| is)|status|summary|overview|dashboard|breakdown|who\s+(has|is|are)|total|count|any\s+overdue|do\s+i\s+have|tell\s+me\s+about|where\s+is\s+\S+\s+(a\s+)?tenant)\b/.test(
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

/**
 * Removes Markdown bold/italic markers the model may still emit (**text**, __text__).
 * Does not run on confirmation-template strings that intentionally use ** for emphasis.
 */
export function stripMarkdownDelimitersFromAssistantText(text: string): string {
  let t = text;
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*\*/g, "");
  t = t.replace(/__([^_]+)__/g, "$1");
  return t;
}

/**
 * Removes internal CEO navigation markup from assistant-visible text. The chat UI may
 * derive buttons from tool JSON / suggested actions instead; any stray tags must not leak.
 */
export function stripNavigateActionTagsFromAssistantText(text: string): string {
  let t = text;
  t = t.replace(/<action\b[\s\S]*?\/>/gi, "");
  t = t.replace(/<action\b[^>]*>/gi, "");
  return t.replace(/\n{3,}/g, "\n\n").trim();
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
        return `• **Rent chase (draft)**${c.input.month ? ` for **${c.input.month}**` : ""} — prepares chase emails; each tenant send stays **pending approval** in Approvals until approved`
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
      case "create_tenant_and_tenancy": {
        const detailLines: string[] = []
        if (c.input.tenant_name?.trim()) detailLines.push(`Tenant: **${c.input.tenant_name.trim()}**`)
        if (c.input.tenant_email?.trim()) detailLines.push(`Email: **${c.input.tenant_email.trim()}**`)
        if (c.input.property_id?.trim()) detailLines.push(`Property ID: **${c.input.property_id.trim()}**`)
        if (c.input.property_query?.trim()) detailLines.push(`Property query: **${c.input.property_query.trim()}**`)
        if (c.input.start_date?.trim()) detailLines.push(`Start date (YYYY-MM-DD): **${c.input.start_date.trim()}**`)
        if (c.input.monthly_rent?.trim()) detailLines.push(`Monthly rent: **${c.input.monthly_rent.trim()}**`)
        const detail = detailLines.length > 0 ? `\n${detailLines.join("\n")}` : ""
        return `• **Create tenant + tenancy, then start onboarding**${detail}\n  This may create records (or safely reuse existing matches), then queue onboarding/welcome-email approval flows where applicable. Reply **yes** only if these values are correct.`
      }
      case "start_tenant_onboarding": {
        const detailLines: string[] = []
        if (c.input.onboarding_for?.trim()) {
          detailLines.push(`Tenant (onboarding_for): **${c.input.onboarding_for.trim()}**`)
        }
        if (c.input.onboarding_property_hint?.trim()) {
          detailLines.push(`Property hint: **${c.input.onboarding_property_hint.trim()}**`)
        }
        if (c.input.start_date?.trim()) {
          detailLines.push(`Tenancy start (YYYY-MM-DD): **${c.input.start_date.trim()}**`)
        }
        const tid = c.input.tenant_id?.trim() ?? ""
        if (tid && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tid)) {
          detailLines.push(`Tenant reference: **${tid}**`)
        }
        if (c.input.lead_id?.trim()) {
          const lid = c.input.lead_id.trim()
          detailLines.push(
            lid.length > 8 ? `Lead ID (prefix): **${lid.slice(0, 8)}…**` : `Lead ID: **${lid}**`,
          )
        }
        const detail = detailLines.length > 0 ? `\n${detailLines.join("\n")}` : ""
        return `• **Start tenant onboarding / create tenancy records**${detail}\n  May create tenancy rows, onboarding tasks, and queue the welcome email for **Approvals**. Reply **yes** only if tenant name, property, and start date match what you intend.`
      }
      case "bulk_onboard_tenants": {
        const rowCount = countCsvRows(c.input.csv_text ?? "")
        const label = rowCount > 0 ? `${rowCount} row${rowCount === 1 ? "" : "s"}` : "CSV rows"
        return `• **Bulk onboard ${label}** (creates property/tenant/tenancy records and kicks off the onboarding agent — welcome emails, ID / Right-to-Rent / references tasks)`
      }
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
        return "• **Dispatch maintenance request** — logs issue; contractor email (if provided) is **pending approval** in Approvals until approved"
      case "generate_property_listing":
        return "• **Generate property listing** (can save generated marketing description to property record)"
      case "get_maintenance_summary":
        return "• **Summarise maintenance tickets** (read-only)"
      case "get_leads_summary":
        return "• **Leads pipeline summary** (read-only)"
      case "get_dashboard_summary":
        return "• **Portfolio dashboard summary** (read-only)"
      case "get_compliance_summary":
        return "• **Compliance & certificates summary** (read-only — EPC, gas safety, electrical)"
      case "get_rent_status":
        return `• **Rent status breakdown**${
          c.input.month ? ` for **${c.input.month}**` : ""
        } (read-only)`
      case "list_tenants":
        return "• **List tenants** (read-only)"
      case "search_properties":
        return "• **Search properties** (read-only — resolve address to property UUIDs)"
      case "send_move_in_email":
        return "• **Move-in instructions email** — queues **pending approval** in Approvals (not sent until approved)"
      case "send_contract":
        return `• **Send tenancy agreement for e-signing**${
          c.input.tenant_name ? ` for **${c.input.tenant_name}**` : ""
        } (emails tenant a signing link when the tool succeeds — not rent collection)`
      default:
        return `• **${(c as { name: string }).name}**`
    }
  })

  const hasReferencingSend = action.toolCalls.some((c) => c.name === "send_referencing_handoff");
  const intro = hasReferencingSend
    ? `The next step will **email your referencing agency** with tenant and property details from Letora (same as the tenancy page handoff):\n\n`
    : `The next step runs **mutating platform tools** (not read-only). Rent chases, move-in email, and contractor dispatch emails are **approval-gated** — they stay **pending approval** in **/dashboard/approvals** until you approve. Other lines below may email or update records as described:\n\n`;

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
