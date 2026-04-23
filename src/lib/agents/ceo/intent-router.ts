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
  | "compliance"
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
  /**
   * True when the user asks for referencing / agency reply status — router must recommend prepare_referencing.
   */
  wantsReferencingStatus: boolean
  /**
   * “Continue/resume onboarding” — prioritize **start_tenant_onboarding** (resume JSON) over generic copy / navigation-only.
   */
  wantsContinueOnboarding: boolean
  /**
   * Read-first onboarding status questions ("next action", "what stage", "what is blocking", "continue")
   * should inspect current state before proposing any mutation.
   */
  wantsOnboardingStateInspection: boolean
  /**
   * “Import these tenants”, “onboard these 20”, pasted CSV — prioritize **bulk_onboard_tenants** over single-tenant onboarding.
   */
  wantsBulkOnboarding: boolean
  /**
   * “Create a new tenant + tenancy” flow from chat, then onboarding.
   */
  wantsCreateTenantTenancy: boolean
  /**
   * Broad “what needs attention / what next / update / blocked” — load dashboard + maintenance + compliance and answer with operator prioritization.
   */
  wantsOperationalBrief: boolean
  needsClarification: boolean
  clarificationQuestion: string | null
}

const INTENT_LABELS: Record<CEOPropertyIntentId, string> = {
  rent_collection: "overdue rent chase (draft emails — Approvals before send; not payment collection)",
  rent_status: "rent status & arrears",
  maintenance: "maintenance & repairs",
  maintenance_dispatch: "maintenance dispatch / contractor coordination",
  compliance: "compliance & legal safety certificates (EPC, gas, electrical)",
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
    case "compliance":
      return ["get_compliance_summary", "get_dashboard_summary"]
    case "leads":
      return ["get_leads_summary"]
    case "onboarding":
      return ["start_tenant_onboarding", "send_move_in_email"]
    case "listing_generation":
      return ["generate_property_listing"]
    case "contracts":
      return ["draft_contract", "send_contract", "send_move_in_email", "get_contracts"]
    case "portfolio":
      return ["get_dashboard_summary", "get_compliance_summary", "get_rent_status"]
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
    compliance: 0,
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
    id: "compliance",
    weight: 2.85,
    re: /\b(compliance|compliance\s+issues?|compliant|landlord\s+cert|legal\s+safety|safety\s+certificates?|certificate\s+expir|expir\w*\s+certificates?|expired\s+certificates?)\b/i,
  },
  {
    id: "compliance",
    weight: 2.75,
    re: /\b(epc|gas\s+safety|electric(?:al)?\s+safety|eicr|\beic\b|cp12|electrical\s+installation)\b/i,
  },
  {
    id: "compliance",
    weight: 2.5,
    re: /\b(gas|electrical|electric)\s+cert(ificate)?s?\b/i,
  },
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
    re: /\b(onboard|onboarding|move[-\s]?in|start\s+onboarding|welcome\s+pack|right\s+to\s+rent|references?|referencing)\b/i,
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
    id: "contracts",
    weight: 2.4,
    re: /\bdraft\s+(\S+\s+)?contract\b/i,
  },
  {
    id: "portfolio",
    weight: 2.2,
    re: /\b(what\s+needs\s+my\s+attention|what'?s\s+going\s+on|portfolio|big\s+picture|summary|dashboard|today|this\s+week|everything\s+ok|catch\s+me\s+up)\b/i,
  },
  {
    id: "portfolio",
    weight: 2.15,
    re: /\b(what\s+needs\s+attention|what\s+should\s+i\s+do|give\s+me\s+an\s+update|anything\s+pending|what'?s\s+pending|what'?s\s+blocked|where\s+should\s+i\s+focus|priorities|priority\b)\b/i,
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
  { id: "tenants", weight: 2.0, re: /\bwhere\s+is\s+\S+\s+(a\s+)?tenant\b/i },
  { id: "tenants", weight: 1.8, re: /\bwhich\s+property\s+is\s+\S+\s+(a\s+)?tenant\s+at\b/i },
]

function isPropertyRelated(text: string): boolean {
  const t = text.toLowerCase()
  return /\b(rent|tenant|tenants|property|properties|flat|house|lease|maintenance|repair|compliance|certificate|epc|lead|leads|contract|tenancy|landlord|portfolio|arrears|overdue|deposit|hmo|block|unit)\b/.test(
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
  "What should we focus on first — **rent & arrears**, **compliance & certificates**, **maintenance**, **new leads**, **contracts / paperwork**, or a quick **portfolio snapshot**?"

const CONFIDENCE_NORMALIZER = 6

/** Lightweight typo normalization so users don't need exact phrasing. */
function normalizeForRouting(text: string): string {
  const t = text.toLowerCase()
  return t
    .replace(/\bghe\b/g, "the")
    .replace(/\bteh\b/g, "the")
    .replace(/\btenats\b/g, "tenants")
    .replace(/\btenent(s)?\b/g, "tenant$1")
    .replace(/\btennant(s)?\b/g, "tenant$1")
    .replace(/\barreers\b/g, "arrears")
    .replace(/\barrers\b/g, "arrears")
    .replace(/\bmaintenence\b/g, "maintenance")
    .replace(/\bmaintainance\b/g, "maintenance")
    .replace(/\bcontrcat(s)?\b/g, "contract$1")
    .replace(/\bcontrct\b/g, "contract")
    .replace(/\bleadz\b/g, "leads")
    .replace(/\bproeprty\b/g, "property")
    .replace(/\bdashbord\b/g, "dashboard")
    .replace(/\bonbosrding\b/g, "onboarding")
}

/** “Referencing update”, “agency reply”, etc. — must route to prepare_referencing (regex “references?” misses “referencing”). */
function detectReferencingStatusQuestion(normalized: string): boolean {
  const mentionsRef =
    /\b(referencing|tenant\s+referencing|letting\s+reference|reference\s+agency|agency\s+referencing)\b/i.test(
      normalized,
    )
  const asksStatus =
    /\b(update|status|progress|news|reply|response|heard|anything\s+from|where\s+are\s+we|chase|follow\s*up)\b/i.test(
      normalized,
    )
  const whatAboutRef = /\bwhat\s+.{0,48}\b(referencing|reference|agency)\b/i.test(normalized)
  return (mentionsRef && asksStatus) || whatAboutRef
}

/** “Continue onboarding”, “resume onboarding” — must load resume JSON, not dashboard-only navigation. */
function detectContinueOnboardingResume(normalized: string): boolean {
  return /\b(continue|resume|carry\s+on)\s+(?:with\s+)?(?:the\s+)?onboarding\b/i.test(normalized)
}

/** Read-first onboarding state checks. */
function detectOnboardingStateInspection(normalized: string): boolean {
  return /\b(next\s+onboarding\s+action|next\s+action\s+for|what\s+stage\s+is|what\s+is\s+blocking|what'?s\s+blocking|what'?s\s+left|remaining\s+onboarding|continue\s+.*onboarding|resume\s+.*onboarding)\b/i.test(
    normalized,
  )
}

/**
 * Detect a bulk/batch onboarding request. We match either:
 *   - explicit intent words (import, bulk, batch, mass) near tenants/properties/onboard, OR
 *   - a pasted CSV header line that uses our required columns.
 */
function detectBulkOnboardingRequest(normalized: string, rawMessage: string): boolean {
  const intentWords =
    /\b(bulk|batch|import|upload|mass|multiple|many|all\s+of\s+these)\b/i
  const targetWords = /\b(tenants?|tenancies?|properties|portfolio|onboard|onboarding|csv|spreadsheet|list)\b/i
  if (intentWords.test(normalized) && targetWords.test(normalized)) return true

  if (/\b(onboard|import|add)\b\s+(?:these|the)?\s*\d+\s+(?:tenants?|tenancies?|properties)\b/i.test(normalized)) {
    return true
  }

  if (/\bhere'?s?\s+(?:my\s+|a\s+)?csv\b/i.test(normalized)) return true

  // Pasted CSV header with our required columns.
  const lower = rawMessage.toLowerCase()
  const hasAddressCol = /property[_\s-]?address|property,|address,/.test(lower)
  const hasTenantCol = /tenant[_\s-]?name|tenant_email|tenant,/.test(lower)
  const hasRentCol = /monthly[_\s-]?rent|\brent,/.test(lower)
  if (hasAddressCol && hasTenantCol && hasRentCol) return true

  return false
}

/** Detect explicit request to create brand-new tenant + tenancy in chat. */
function detectCreateTenantTenancyRequest(normalized: string): boolean {
  const hasCreate = /\b(create|add|set\s*up|onboard)\b/i.test(normalized)
  const hasTenant = /\b(new\s+tenant|tenant\s+record|tenant)\b/i.test(normalized)
  const hasTenancy = /\b(tenancy|lease)\b/i.test(normalized)
  return hasCreate && hasTenant && hasTenancy
}

/** “What needs attention”, “what next”, “update”, “blocked”, etc. — portfolio-style operational brief. */
function detectOperationalBriefRequest(normalized: string): boolean {
  return /\b(what\s+needs\s+(?:my\s+)?attention|what\s+should\s+i\s+do(?:\s+next)?|what'?s\s+next|what\s+to\s+do\s+next|what'?s\s+pending|what\s+is\s+pending|what'?s\s+blocked|what\s+is\s+blocked|give\s+me\s+an\s+update|status\s+update|catch\s+me\s+up|anything\s+i\s+need\s+to\s+do|anything\s+pending|portfolio\s+health|where\s+should\s+i\s+focus|priorities|priority\b|big\s+picture|what'?s\s+going\s+on)\b/i.test(
    normalized,
  )
}

/**
 * Maps natural-language property-management phrasing to internal tools and safety hints.
 */
export function routeCEOIntent(userMessage: string): CEOIntentRoute {
  const trimmed = userMessage.trim()
  const normalized = normalizeForRouting(trimmed)
  const wantsOperationalBrief = detectOperationalBriefRequest(normalized)
  const wantsLeadQualification = /\bqualify\b/i.test(normalized) && /\bleads?\b/i.test(normalized)
  const wantsReferencingStatusEarly = detectReferencingStatusQuestion(normalized)
  const wantsContinueOnboarding =
    detectContinueOnboardingResume(normalized) ||
    (/\b(continue|resume)\b/i.test(normalized) && /\bonboarding\s+for\b/i.test(normalized))
  const wantsOnboardingStateInspection = detectOnboardingStateInspection(normalized)
  const wantsBulkOnboarding = detectBulkOnboardingRequest(normalized, trimmed)
  const wantsCreateTenantTenancy = detectCreateTenantTenancyRequest(normalized)
  const scores = scoreMessage(normalized)
  if (wantsBulkOnboarding) {
    scores.onboarding += 3
  }
  if (wantsCreateTenantTenancy) {
    scores.onboarding += 2.7
  }
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)

  if (totalScore <= 0) {
    const wantsOnboardingByPlainName = detectOnboardingByPlainName(normalized)
    const needsClarification =
      isPropertyRelated(normalized) &&
      trimmed.length >= 10 &&
      trimmed.length <= 600 &&
      !isAffirmativeShort(trimmed) &&
      !wantsOnboardingByPlainName &&
      !wantsReferencingStatusEarly &&
      !wantsContinueOnboarding

    if (wantsReferencingStatusEarly && !wantsOnboardingByPlainName) {
      return {
        primaryIntent: "portfolio",
        secondaryIntents: [],
        confidence: 0.55,
        recommendedTools: ["prepare_referencing", "list_tenants"],
        confirmationRequired: false,
        wantsLeadQualification,
        wantsOnboardingByPlainName: false,
        wantsReferencingStatus: true,
        wantsContinueOnboarding: false,
        wantsOnboardingStateInspection: false,
        wantsBulkOnboarding: false,
        wantsCreateTenantTenancy: false,
        wantsOperationalBrief,
        needsClarification: false,
        clarificationQuestion: null,
      }
    }

    return {
      primaryIntent:
        wantsBulkOnboarding || wantsOnboardingByPlainName || wantsContinueOnboarding
          ? "onboarding"
          : "portfolio",
      secondaryIntents: [],
      confidence:
        wantsBulkOnboarding || wantsOnboardingByPlainName || wantsContinueOnboarding ? 0.45 : 0,
      recommendedTools: wantsBulkOnboarding
        ? ["bulk_onboard_tenants"]
        : wantsCreateTenantTenancy
          ? ["create_tenant_and_tenancy"]
        : wantsOnboardingStateInspection
          ? ["resolve_onboarding_navigation", "get_contracts", "prepare_referencing"]
        : wantsOnboardingByPlainName || wantsContinueOnboarding
          ? ["start_tenant_onboarding"]
          : wantsOperationalBrief
            ? ["get_dashboard_summary", "get_maintenance_summary", "get_compliance_summary"]
            : [],
      confirmationRequired:
        wantsBulkOnboarding
          ? toolsRequireUserConfirmation(classifyCEOIntent(normalized), ["bulk_onboard_tenants"])
          : wantsCreateTenantTenancy
            ? toolsRequireUserConfirmation(classifyCEOIntent(normalized), ["create_tenant_and_tenancy"])
          : wantsOnboardingStateInspection
            ? false
          : wantsOnboardingByPlainName || wantsContinueOnboarding
            ? toolsRequireUserConfirmation(classifyCEOIntent(normalized), ["start_tenant_onboarding"])
            : false,
      wantsLeadQualification,
      wantsOnboardingByPlainName,
      wantsReferencingStatus: false,
      wantsContinueOnboarding,
      wantsOnboardingStateInspection,
      wantsBulkOnboarding,
      wantsCreateTenantTenancy,
      wantsOperationalBrief,
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

  const wantsReferencingStatus = detectReferencingStatusQuestion(normalized)
  if (wantsReferencingStatus) {
    recommendedTools = uniqueToolsOrdered(
      [
        "prepare_referencing",
        "list_tenants",
        ...recommendedTools.filter((t) => t !== "prepare_referencing" && t !== "list_tenants"),
      ],
      6,
    )
  }

  if (wantsContinueOnboarding) {
    const continuePriorityTools: CEOToolName[] = wantsOnboardingStateInspection
      ? ["resolve_onboarding_navigation", "get_contracts", "prepare_referencing"]
      : ["start_tenant_onboarding"]
    recommendedTools = uniqueToolsOrdered(
      [
        ...continuePriorityTools,
        ...recommendedTools.filter(
          (t) =>
            t !== "start_tenant_onboarding" &&
            t !== "resolve_onboarding_navigation" &&
            t !== "get_contracts" &&
            t !== "prepare_referencing",
        ),
      ],
      6,
    )
  }

  if (wantsOnboardingStateInspection) {
    recommendedTools = uniqueToolsOrdered(
      [
        "resolve_onboarding_navigation",
        "get_contracts",
        "prepare_referencing",
        ...recommendedTools.filter(
          (t) =>
            t !== "resolve_onboarding_navigation" &&
            t !== "get_contracts" &&
            t !== "prepare_referencing" &&
            t !== "start_tenant_onboarding" &&
            t !== "create_tenant_and_tenancy",
        ),
      ],
      6,
    )
  }

  if (wantsBulkOnboarding) {
    recommendedTools = uniqueToolsOrdered(
      [
        "bulk_onboard_tenants",
        ...recommendedTools.filter((t) => t !== "bulk_onboard_tenants"),
      ],
      6,
    )
  }

  if (wantsCreateTenantTenancy) {
    recommendedTools = uniqueToolsOrdered(
      [
        "create_tenant_and_tenancy",
        ...recommendedTools.filter((t) => t !== "create_tenant_and_tenancy"),
      ],
      6,
    )
  }

  const wantsCompliancePriority =
    /\b(compliance|epc|gas\s+safety|electric(?:al)?\s+safety|eicr|landlord\s+cert|safety\s+cert|certificate\s+expir|expired\s+cert|expiring\s+cert|legal\s+safety)\b/i.test(
      normalized,
    ) || /\b(gas|electrical|electric)\s+cert(ificate)?s?\b/i.test(normalized)
  if (wantsCompliancePriority) {
    recommendedTools = uniqueToolsOrdered(
      [
        "get_compliance_summary",
        ...recommendedTools.filter((t) => t !== "get_compliance_summary"),
      ],
      6,
    )
  }

  if (wantsOperationalBrief) {
    recommendedTools = uniqueToolsOrdered(
      [
        "get_dashboard_summary",
        "get_maintenance_summary",
        "get_compliance_summary",
        ...recommendedTools,
      ],
      6,
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
    !isAffirmativeShort(trimmed) &&
    !wantsReferencingStatus &&
    !wantsContinueOnboarding &&
    !wantsOperationalBrief

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
    wantsReferencingStatus,
    wantsContinueOnboarding,
    wantsOnboardingStateInspection,
    wantsBulkOnboarding,
    wantsCreateTenantTenancy,
    wantsOperationalBrief,
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
  if (
    route.needsClarification &&
    !route.wantsOnboardingByPlainName &&
    !route.wantsReferencingStatus &&
    !route.wantsContinueOnboarding &&
    !route.wantsOnboardingStateInspection &&
    !route.wantsOperationalBrief
  ) {
    return ""
  }
  if (
    route.confidence === 0 &&
    route.recommendedTools.length === 0 &&
    !route.wantsOnboardingByPlainName &&
    !route.wantsReferencingStatus &&
    !route.wantsContinueOnboarding &&
    !route.wantsOnboardingStateInspection &&
    !route.wantsOperationalBrief
  ) {
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

  if (route.wantsReferencingStatus) {
    lines.push(
      "- **Required (referencing / agency status):** Call **prepare_referencing** this turn with **tenant_name** taken from the user’s message (e.g. “Alexis” / “Alexis Adeosun”) when they named someone; otherwise use **list_tenants** then **prepare_referencing** with the correct **tenancy_id**. Read **recent_inbound_mail** and **ceo_instruction** in the tool JSON — if they say inbound rows exist, you **must** summarize those previews and **must not** claim the agency has not responded or that there is no inbound mail.",
    )
  }

  if (route.wantsContinueOnboarding && !route.wantsOnboardingStateInspection) {
    lines.push(
      "- **Required (continue/resume onboarding):** Call **start_tenant_onboarding** with **onboarding_for** when they named a tenant; otherwise **list_tenants** then **start_tenant_onboarding**. Summarize **pending_task_names**, **tasks_complete**/**tasks_total**, and **referencing_complete** from that JSON (or from **resolve_onboarding_navigation** if you also used it) — do **not** invent a generic checklist. **resolve_onboarding_navigation** is for the **Open onboarding** button only; it is not a substitute for **start_tenant_onboarding** resume data.",
    )
  }

  if (route.wantsOnboardingStateInspection) {
    lines.push(
      "- **Required (onboarding next-step / stage / blocker):** Start read-first. Call **resolve_onboarding_navigation** (plus **get_contracts** and **prepare_referencing** when useful) to inspect current tenancy/onboarding/contract state before any mutation. Return: current stage, completed steps, blocker (if any), and next valid action. Do **not** call **start_tenant_onboarding** or **create_tenant_and_tenancy** unless inspection proves no tenancy/onboarding exists and the user asks you to proceed.",
    )
  }

  if (route.wantsBulkOnboarding) {
    lines.push(
      "- **Required (bulk / batch onboarding):** Call **bulk_onboard_tenants** with **csv_text** copied verbatim from the user's message. On the first turn, set **preview=true** and summarize the `summary` counters (`newProperties`, `matchedProperties`, `validationErrors`, `skippedActiveTenancies`, `actionableRows`) plus a few `preview_rows`. Do **not** call **start_tenant_onboarding** for individual rows when a CSV is present — the executor fans out per row. Ask the user to confirm before running the actual import (drop `preview`).",
    )
  }

  if (route.wantsCreateTenantTenancy) {
    lines.push(
      "- **Required (new tenant + tenancy creation):** Call **create_tenant_and_tenancy** when the user asks to onboard a brand-new tenant. Pass collected fields: **tenant_name**, **tenant_email**, **property_id** (or **property_query**), **start_date** (YYYY-MM-DD), **monthly_rent**. If the tool returns **blocked_by**, ask only for those missing fields (minimum blocker). If it returns **property_ambiguous**, present candidates and ask for one property confirmation only. Do not redirect to manual Leads/Tenants pages unless the tool reports an actual backend blocker.",
    )
  }

  if (route.wantsOperationalBrief) {
    lines.push(
      "- **Required (operational brief / what next):** The user asked for a portfolio-style update. Call **get_dashboard_summary**, **get_maintenance_summary**, and **get_compliance_summary** in parallel this turn (unless they already narrowed to one domain). Structure the reply: (1) **Top priority** — one line, (2) **Why** — one sentence; every claim tied to a JSON field you saw, (3) **1–3 items needing review** — use names/addresses from JSON when available; include **/dashboard/approvals** when approval-gated comms may be waiting (chat tools do not list each approval row; do not invent counts, ages, or queue order), (4) **Blockers** — JSON-backed; if several rows share one root cause, state that **shared blocker** once (not the same blocker repeated per row), (5) optional **Pattern to watch** — one short hedged line **only** when the **same** blocker or theme appears on **multiple** rows in **this** turn’s data (see **Recurring patterns and snapshot scope**); omit if unsupported — **no** long-term trends or chat memory, (6) **One recommended next action**. **Within-bucket ranking:** use severity rules in the system prompt (overdue days, amounts, **priority**, **email_sent**, missing emails) **only** where those fields exist; if you cannot rank inside a bucket, say so and fall back to category priority + Approvals.",
    )
  }

  if (route.primaryIntent === "compliance" || route.secondaryIntents.includes("compliance")) {
    lines.push(
      "- **Required (compliance / certificates):** Call **get_compliance_summary** this turn. Data lives in **compliance_records** (per property), not in maintenance tickets. Do **not** answer compliance questions using **get_maintenance_summary** alone.",
    )
  }

  if (route.secondaryIntents.length > 0) {
    const labels = route.secondaryIntents.map((id) => INTENT_LABELS[id]).join("; ")
    lines.push(`- Also consider if relevant: ${labels}.`)
  }

  lines.push(
    `- If the user’s wording spans multiple intents, choose a sensible primary action and briefly acknowledge secondary topics in your reply.`,
    `- **Control plane:** Respect action tiers in the system prompt (autonomous / notify / approval required / forbidden). Route **pending approval** work to **/dashboard/approvals**; never imply tenant payment collection or payouts.`,
    `- Safety: approximate confirmation requirement for this tool mix: **${route.confirmationRequired ? "yes — chat confirmation before the batch runs; Approvals still applies when tools return pending_approval" : "reads and notify-tier tools can proceed per policy"}**.`,
  )

  return lines.join("\n")
}
