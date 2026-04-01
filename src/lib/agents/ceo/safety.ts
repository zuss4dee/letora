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
  "list_tenants",
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
    /\b(send|dispatch|blast|transmit|actually\s+send|go\s+ahead\s+and\s+send|email\s+them\s+now|mark\s+.*\s+resolved|mark\s+as\s+resolved|close\s+the\s+tickets?|delete\s+|remove\s+permanently|cancel\s+the\s+|finalize\s+and\s+send)\b/.test(
      t,
    )
  ) {
    return "confirmation_required"
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
 */
export function toolsRequireUserConfirmation(
  intent: CEOIntent,
  toolNames: readonly CEOToolName[],
): boolean {
  const mutating = toolNames.filter((n) => !isReadOnlyTool(n))
  if (mutating.length === 0) return false
  if (intent === "draft_suggest") return false
  return true
}

export function isAffirmativeConfirmation(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t === "y") return true
  return /^(yes|yep|yeah|yup|sure|ok|okay|confirm|confirmed|do\s+it|go\s+ahead|proceed|please\s+do)\b/.test(
    t,
  )
}

function normalizeToolInput(input: unknown): Record<string, string> {
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
    return { name, input: normalizeToolInput(b.input) }
  })
  return { v: 1, toolCalls }
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
      case "get_maintenance_summary":
        return "• **Summarise maintenance tickets** (read-only)"
      case "get_dashboard_summary":
        return "• **Portfolio dashboard summary** (read-only)"
      case "get_rent_status":
        return `• **Rent status breakdown**${
          c.input.month ? ` for **${c.input.month}**` : ""
        } (read-only)`
      case "list_tenants":
        return "• **List tenants** (read-only)"
      default:
        return `• **${(c as { name: string }).name}**`
    }
  })

  return (
    `The next step may **contact tenants** or **change what they see**, or run actions that go beyond a simple lookup:\n\n${lines.join("\n")}\n\n` +
    `Reply **yes** to proceed, or tell me what to change.`
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
