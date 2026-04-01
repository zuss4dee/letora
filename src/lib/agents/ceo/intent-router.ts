import {
  classifyCEOIntent,
  toolsRequireUserConfirmation,
  type CEOIntent,
} from "./safety"
import type { CEOToolName } from "./tools"

export type CEOPropertyIntentId =
  | "rent_collection"
  | "rent_status"
  | "maintenance"
  | "leads"
  | "contracts"
  | "portfolio"
  | "tenants"

export type CEOIntentRoute = {
  primaryIntent: CEOPropertyIntentId
  secondaryIntents: CEOPropertyIntentId[]
  confidence: number
  recommendedTools: CEOToolName[]
  confirmationRequired: boolean
  needsClarification: boolean
  clarificationQuestion: string | null
}

const INTENT_LABELS: Record<CEOPropertyIntentId, string> = {
  rent_collection: "rent collection / chasing overdue rent",
  rent_status: "rent status & arrears",
  maintenance: "maintenance & repairs",
  leads: "leads & prospect qualification",
  contracts: "contracts & tenancy paperwork",
  portfolio: "portfolio overview & priorities",
  tenants: "tenant directory & filters",
}

function toolsForIntent(id: CEOPropertyIntentId): CEOToolName[] {
  switch (id) {
    case "rent_collection":
      return ["get_rent_status", "chase_rent"]
    case "rent_status":
      return ["get_rent_status", "list_tenants"]
    case "maintenance":
      return ["get_maintenance_summary"]
    case "leads":
      return ["get_leads_summary"]
    case "contracts":
      return ["draft_contract"]
    case "portfolio":
      return ["get_dashboard_summary", "get_rent_status"]
    case "tenants":
      return ["list_tenants"]
  }
}

function uniqueToolsOrdered(tools: readonly CEOToolName[], max: number): CEOToolName[] {
  const seen = new Set<string>()
  const out: CEOToolName[] = []
  for (const t of tools) {
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= max) break
  }
  return out
}

type ScoreRow = Record<CEOPropertyIntentId, number>

function emptyScores(): ScoreRow {
  return {
    rent_collection: 0,
    rent_status: 0,
    maintenance: 0,
    leads: 0,
    contracts: 0,
    portfolio: 0,
    tenants: 0,
  }
}

/** Central pattern list — higher weight = stronger signal. */
const ROUTE_PATTERNS: ReadonlyArray<{
  id: CEOPropertyIntentId
  weight: number
  re: RegExp
}> = [
  {
    id: "rent_collection",
    weight: 2.2,
    re: /\b(overdue\s+stuff|sort\s+(the\s+)?overdue|rent\s+chase|chase\s+(the\s+)?rent|collect\s+rent|money\s+owed|unpaid\s+rent|arrears|arrear|remind\s+tenants|send\s+reminders)\b/i,
  },
  {
    id: "rent_status",
    weight: 1.8,
    re: /\b(rent\s+status|who\s+owes|paid\s+vs|rent\s+roll|rent\s+breakdown|how\s+much\s+rent|overdue\s+tenants|late\s+rent)\b/i,
  },
  { id: "rent_status", weight: 1, re: /\b(overdue|rent\s+due|due\s+rent)\b/i },
  {
    id: "maintenance",
    weight: 2,
    re: /\b(maintenance|urgent\s+repairs?|what'?s\s+broken|repairs?|fix(es|ing)?|boiler|leak|damp|ticket|work\s+order)\b/i,
  },
  {
    id: "leads",
    weight: 2,
    re: /\b(new\s+leads?|bad\s+leads?|qualify\s+(prospects|leads)|prospect|inquir(y|ies)|viewing\s+requests?)\b/i,
  },
  { id: "leads", weight: 1.8, re: /\b(do\s+i\s+have\s+any\s+leads?|any\s+leads?)\b/i },
  {
    id: "contracts",
    weight: 2,
    re: /\b(contracts?|tenancy\s+docs?|draft\s+paperwork|ast|tenancy\s+agreement|lease\s+doc)\b/i,
  },
  {
    id: "portfolio",
    weight: 2.2,
    re: /\b(what\s+needs\s+my\s+attention|what'?s\s+going\s+on|portfolio|big\s+picture|summary|dashboard|today|this\s+week|everything\s+ok|catch\s+me\s+up)\b/i,
  },
  // “List my active tenants” has words between list and tenants — keep patterns broad.
  {
    id: "tenants",
    weight: 2.2,
    re: /\b(list|show|give)\s+(me\s+)?(my\s+|the\s+|our\s+|all\s+)?(active\s+)?tenants?\b/i,
  },
  {
    id: "tenants",
    weight: 2,
    re: /\b(list|show)\s+(me\s+)?(all\s+|every\s+)?(active\s+)?tenants?\b/i,
  },
  { id: "tenants", weight: 1.8, re: /\b(active\s+tenants?|tenant\s+list|which\s+tenants?|all\s+tenants?)\b/i },
  { id: "tenants", weight: 1.6, re: /\b(who\s+are\s+(my\s+|the\s+)?tenants?|tenants?\s+in\s+the\s+system)\b/i },
  { id: "tenants", weight: 1.5, re: /\b(list\s+tenants|all\s+tenants)\b/i },
]

function isPropertyRelated(text: string): boolean {
  const t = text.toLowerCase()
  return /\b(rent|tenant|tenants|property|properties|flat|house|lease|maintenance|repair|lead|leads|contract|tenancy|landlord|portfolio|arrears|overdue|deposit|hmo|block|unit)\b/.test(
    t,
  )
}

function isAffirmativeShort(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length <= 4) {
    return /^(yes|yep|yeah|ok|y)$/i.test(t)
  }
  return false
}

function scoreMessage(text: string): ScoreRow {
  const scores = emptyScores()
  for (const { id, weight, re } of ROUTE_PATTERNS) {
    if (re.test(text)) scores[id] += weight
  }
  return scores
}

function pickPrimary(scores: ScoreRow): CEOPropertyIntentId {
  let best: CEOPropertyIntentId = "portfolio"
  let max = -1
  const keys = Object.keys(scores) as CEOPropertyIntentId[]
  for (const k of keys) {
    if (scores[k] > max) {
      max = scores[k]
      best = k
    }
  }
  if (max <= 0) return "portfolio"
  return best
}

function pickSecondaries(
  scores: ScoreRow,
  primary: CEOPropertyIntentId,
  primaryScore: number,
): CEOPropertyIntentId[] {
  if (primaryScore <= 0) return []
  const threshold = primaryScore * 0.48
  const keys = Object.keys(scores) as CEOPropertyIntentId[]
  const out: CEOPropertyIntentId[] = []
  for (const k of keys) {
    if (k === primary) continue
    if (scores[k] >= threshold && scores[k] > 0.35) out.push(k)
  }
  return out.sort((a, b) => scores[b] - scores[a])
}

const CLARIFICATION_QUESTION =
  "What should we focus on first — **rent & arrears**, **maintenance**, **new leads**, **contracts / paperwork**, or a quick **portfolio snapshot**?"

const CONFIDENCE_NORMALIZER = 6

/** Lightweight typo normalization so users don't need exact phrasing. */
function normalizeForRouting(text: string): string {
  const t = text.toLowerCase()
  return t
    .replace(/\btenats\b/g, "tenants")
    .replace(/\btenent(s)?\b/g, "tenant$1")
    .replace(/\btennant(s)?\b/g, "tenant$1")
    .replace(/\barreers\b/g, "arrears")
    .replace(/\barrers\b/g, "arrears")
    .replace(/\bmaintenence\b/g, "maintenance")
    .replace(/\bmaintainance\b/g, "maintenance")
    .replace(/\bcontrcat(s)?\b/g, "contract$1")
    .replace(/\bleadz\b/g, "leads")
    .replace(/\bproeprty\b/g, "property")
    .replace(/\bdashbord\b/g, "dashboard")
}

/**
 * Maps natural-language property-management phrasing to internal tools and safety hints.
 */
export function routeCEOIntent(userMessage: string): CEOIntentRoute {
  const trimmed = userMessage.trim()
  const normalized = normalizeForRouting(trimmed)
  const scores = scoreMessage(normalized)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)

  if (totalScore <= 0) {
    const needsClarification =
      isPropertyRelated(normalized) &&
      trimmed.length >= 10 &&
      trimmed.length <= 600 &&
      !isAffirmativeShort(trimmed)

    return {
      primaryIntent: "portfolio",
      secondaryIntents: [],
      confidence: 0,
      recommendedTools: [],
      confirmationRequired: false,
      needsClarification,
      clarificationQuestion: needsClarification ? CLARIFICATION_QUESTION : null,
    }
  }

  const primaryIntent = pickPrimary(scores)
  const primaryScore = scores[primaryIntent]
  const secondaryIntents = pickSecondaries(scores, primaryIntent, primaryScore)

  const toolBuckets: CEOToolName[] = []
  toolBuckets.push(...toolsForIntent(primaryIntent))
  for (const s of secondaryIntents) {
    toolBuckets.push(...toolsForIntent(s))
  }
  const recommendedTools = uniqueToolsOrdered(toolBuckets, 5)

  const confidence = Math.min(1, primaryScore / CONFIDENCE_NORMALIZER)

  const safetyIntent: CEOIntent = classifyCEOIntent(normalized)
  const confirmationRequired = toolsRequireUserConfirmation(safetyIntent, recommendedTools)

  const strongEnough = primaryScore >= 0.95 || confidence >= 0.35
  const needsClarification =
    !strongEnough &&
    isPropertyRelated(normalized) &&
    trimmed.length >= 10 &&
    trimmed.length <= 600 &&
    !isAffirmativeShort(trimmed)

  return {
    primaryIntent,
    secondaryIntents,
    confidence,
    recommendedTools,
    confirmationRequired,
    needsClarification,
    clarificationQuestion: needsClarification ? CLARIFICATION_QUESTION : null,
  }
}

/**
 * Injected into the model system prompt so Claude aligns tool choice with the router.
 */
export function formatRouterHintForSystem(route: CEOIntentRoute): string {
  if (route.needsClarification) return ""
  if (route.confidence === 0 && route.recommendedTools.length === 0) return ""

  const lines: string[] = [
    "Intent routing (prioritize these tools where they match the user’s words; you may call several in parallel when the request spans multiple areas):",
    `- Primary: **${INTENT_LABELS[route.primaryIntent]}** (confidence ~${route.confidence.toFixed(2)}).`,
  ]

  if (route.recommendedTools.length > 0) {
    lines.push(`- Recommended tools: ${route.recommendedTools.join(", ")}.`)
  }

  if (route.secondaryIntents.length > 0) {
    const labels = route.secondaryIntents.map((id) => INTENT_LABELS[id]).join("; ")
    lines.push(`- Also consider if relevant: ${labels}.`)
  }

  lines.push(
    `- If the user’s wording spans multiple intents, choose a sensible primary action and briefly acknowledge secondary topics in your reply.`,
    `- Safety: approximate confirmation requirement for this tool mix: **${route.confirmationRequired ? "yes — follow platform confirmation rules before send/change actions" : "reads and drafts can proceed per policy"}**.`,
  )

  return lines.join("\n")
}
