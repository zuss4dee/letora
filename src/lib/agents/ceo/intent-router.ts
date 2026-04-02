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
  | "maintenance_dispatch"
  | "leads"
  | "onboarding"
  | "listing_generation"
  | "contracts"
  | "portfolio"
  | "tenants"

export type CEOIntentRoute = {
  primaryIntent: CEOPropertyIntentId
  secondaryIntents: CEOPropertyIntentId[]
  confidence: number
  recommendedTools: CEOToolName[]
  confirmationRequired: boolean
  /** True when the user asked to qualify lead(s); used to ensure qualify_leads runs in chat. */
  wantsLeadQualification: boolean
  /**
   * True when phrasing is like “start onboarding for [Name]” — model must use onboarding_for, not ask for UUIDs first.
   */
  wantsOnboardingByPlainName: boolean
  needsClarification: boolean
  clarificationQuestion: string | null
}

const INTENT_LABELS: Record<CEOPropertyIntentId, string> = {
  rent_collection: "rent collection / chasing overdue rent",
  rent_status: "rent status & arrears",
  maintenance: "maintenance & repairs",
  maintenance_dispatch: "maintenance dispatch / contractor coordination",
  leads: "leads & prospect qualification",
  onboarding: "tenant onboarding workflows",
  listing_generation: "property listing generation",
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
    case "maintenance_dispatch":
      return ["dispatch_maintenance_request", "get_maintenance_summary"]
    case "leads":
      return ["get_leads_summary"]
    case "onboarding":
      return ["start_tenant_onboarding"]
    case "listing_generation":
      return ["generate_property_listing"]
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
    maintenance_dispatch: 0,
    leads: 0,
    onboarding: 0,
    listing_generation: 0,
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
    id: "maintenance_dispatch",
    weight: 2.4,
    re: /\b(log|report|raise|dispatch|send|assign)\s+.*\b(maintenance|repair|issue|contractor|plumber|electrician)\b/i,
  },
  {
    id: "leads",
    weight: 2,
    re: /\b(new\s+leads?|bad\s+leads?|qualify\s+(prospects|leads)|prospect|inquir(y|ies)|viewing\s+requests?)\b/i,
  },
  /** “Qualify pending leads” — words between qualify and leads */
  { id: "leads", weight: 2.5, re: /\bqualify\b[\s\S]{0,48}\bleads?\b/i },
  { id: "leads", weight: 1.8, re: /\b(do\s+i\s+have\s+any\s+leads?|any\s+leads?)\b/i },
  /** Singular “lead” / “show me my lead” */
  {
    id: "leads",
    weight: 2.6,
    re: /\b(show\s+me\s+)?(my\s+)?(the\s+)?leads?\b/i,
  },
  {
    id: "onboarding",
    weight: 2.4,
    re: /\b(onboard|onboarding|move[-\s]?in|start\s+onboarding|welcome\s+pack|right\s+to\s+rent|references?)\b/i,
  },
  {
    id: "listing_generation",
    weight: 2.3,
    re: /\b(listing|advert|ad\s+copy|marketing\s+description|property\s+description|rightmove|zoopla)\b/i,
  },
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
  const wantsLeadQualification = /\bqualify\b/i.test(normalized) && /\bleads?\b/i.test(normalized)
  const scores = scoreMessage(normalized)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)

  if (totalScore <= 0) {
    const wantsOnboardingByPlainName = detectOnboardingByPlainName(normalized)
    const needsClarification =
      isPropertyRelated(normalized) &&
      trimmed.length >= 10 &&
      trimmed.length <= 600 &&
      !isAffirmativeShort(trimmed) &&
      !wantsOnboardingByPlainName

    return {
      primaryIntent: wantsOnboardingByPlainName ? "onboarding" : "portfolio",
      secondaryIntents: [],
      confidence: wantsOnboardingByPlainName ? 0.45 : 0,
      recommendedTools: wantsOnboardingByPlainName ? ["start_tenant_onboarding"] : [],
      confirmationRequired: wantsOnboardingByPlainName
        ? toolsRequireUserConfirmation(classifyCEOIntent(normalized), ["start_tenant_onboarding"])
        : false,
      wantsLeadQualification,
      wantsOnboardingByPlainName,
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
  let recommendedTools = uniqueToolsOrdered(toolBuckets, 5)

  if (wantsLeadQualification) {
    recommendedTools = uniqueToolsOrdered(
      ["qualify_leads", ...recommendedTools.filter((t) => t !== "qualify_leads")],
      5,
    )
  }

  const wantsLeadNurture =
    /\bleads?\b/i.test(normalized) &&
    /\b(contact|email|reach\s+out|nurture|follow\s+up|initial\s+contact|schedule\s+viewing|book\s+viewing|application\s+link)\b/i.test(
      normalized,
    )
  if (wantsLeadNurture) {
    recommendedTools = uniqueToolsOrdered(
      [
        "get_leads_summary",
        "nurture_lead",
        ...recommendedTools.filter((t) => t !== "get_leads_summary" && t !== "nurture_lead"),
      ],
      5,
    )
  }

  const wantsLeadDecision =
    /\b(approve|reject)\b/i.test(normalized) &&
    (/\b(applicant|application|applied)\b/i.test(normalized) || /\b(this|that|the)\s+lead\b/i.test(normalized))
  if (wantsLeadDecision) {
    recommendedTools = uniqueToolsOrdered(
      [
        "get_leads_summary",
        "decide_lead_application",
        ...recommendedTools.filter((t) => t !== "get_leads_summary" && t !== "decide_lead_application"),
      ],
      5,
    )
  }

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

  const wantsOnboardingByPlainName =
    detectOnboardingByPlainName(normalized) &&
    (primaryIntent === "onboarding" || scores.onboarding >= 1)

  return {
    primaryIntent,
    secondaryIntents,
    confidence,
    recommendedTools,
    confirmationRequired,
    wantsLeadQualification,
    wantsOnboardingByPlainName,
    needsClarification,
    clarificationQuestion: needsClarification ? CLARIFICATION_QUESTION : null,
  }
}

/** “Start onboarding for Jane Smith” / “onboarding for …” — use tool param onboarding_for, not UUID preflight. */
function detectOnboardingByPlainName(normalized: string): boolean {
  const mentionsOnboardingForName =
    /\b(start\s+)?onboarding\s+for\b/i.test(normalized) ||
    /\bonboard(?:ing)?\s+for\b/i.test(normalized)
  if (!mentionsOnboardingForName) return false
  // Optional: user pasted UUID workflow — don’t override with name hint
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(normalized)) {
    return false
  }
  return true
}

/**
 * Injected into the model system prompt so Claude aligns tool choice with the router.
 */
export function formatRouterHintForSystem(route: CEOIntentRoute): string {
  // Still inject mandatory tool hints (e.g. onboarding_for) even if the generic “pick a category” clarifier would otherwise hide routing.
  if (route.needsClarification && !route.wantsOnboardingByPlainName) return ""
  if (route.confidence === 0 && route.recommendedTools.length === 0 && !route.wantsOnboardingByPlainName) {
    return ""
  }

  const lines: string[] = [
    "Intent routing (prioritize these tools where they match the user’s words; you may call several in parallel when the request spans multiple areas):",
    `- Primary: **${INTENT_LABELS[route.primaryIntent]}** (confidence ~${route.confidence.toFixed(2)}).`,
  ]

  if (route.recommendedTools.length > 0) {
    lines.push(`- Recommended tools: ${route.recommendedTools.join(", ")}.`)
  }

  if (route.wantsLeadQualification) {
    lines.push(
      "- **Required:** The user asked to **qualify** lead(s). Call **qualify_leads** in this turn (not only get_leads_summary). If you use get_leads_summary, you must still call qualify_leads so scores and statuses are persisted.",
    )
  }

  if (route.wantsOnboardingByPlainName) {
    lines.push(
      "- **Required (onboarding by name):** Call **start_tenant_onboarding** with **onboarding_for** set to the tenant’s **full name** taken from the user’s message (the name after “for”). Do **not** tell the user the system only accepts UUIDs. Do **not** ask them to list tenants or paste IDs before calling the tool. If they mentioned a street, city, or postcode, also set **onboarding_property_hint**. Only if the tool JSON returns **candidates** (multiple tenancies) should you ask which property — using addresses from **candidates**, not raw UUIDs.",
    )
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
