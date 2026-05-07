import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { runLeadQualifierAgent } from "@/lib/agents/lead-qualifier";
import { runMaintenanceAgent } from "@/lib/agents/maintenance-agent";
import { runRentChaserAgent } from "@/lib/agents/rent-chaser";
import { getOnboardingChatSnapshotForTenancy, runTenantOnboardingAgent } from "@/lib/agents/tenant-onboarding";
import { runLLM } from "@/lib/llm/router";
import { sendEmailTool } from "@/lib/tools/send-email";
import { labelPropertyRow, rankPropertySearch, type PropertySearchRow } from "@/lib/agents/ceo/search-properties";
import {
  looksLikeUuid,
  resolveTenantProfileForAccount,
  sanitizeIlikeNameFragment,
} from "@/lib/agents/ceo/resolve-tenant-profile";
import { createAgentApproval } from "@/lib/actions/agent-approvals";
import { enqueueMoveInEmailApproval } from "@/lib/onboarding/move-in-email-approval";
import { runReferencingHandoffForUser } from "@/lib/actions/referencing";
import { computeApprovalQueueStats } from "@/lib/approvals/queue-stats";
import type {
  AgentApprovalActionType,
  AgentApprovalRow,
  ApproveMaintenanceDispatchEvidence,
  CreateAgentApprovalContract,
} from "@/lib/approvals/types";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
import {
  type PropertyRowForMatch,
  resolvePropertyRowsForDraftHint,
} from "@/lib/agents/ceo/property-match";
import type { CEOToolName } from "./tools";
import { normalizeCEOToolInput } from "./safety";

function formatTenantNameFromProfile(tenant: { full_name?: string | null } | null): string {
  return tenant?.full_name?.trim() || "Unknown tenant";
}

/** Strip trailing prepositions left over from natural-language tool args (e.g. "alexis at" → "alexis"). */
function sanitizeTenantName(raw: string): string {
  return raw.replace(/\s+(at|in|for|from|with|of)\s*$/i, "").trim();
}

type ApprovalQueueCategory = "onboarding" | "rent_chase" | "move_in" | "maintenance" | "other";

function categoryForApprovalActionType(actionType: AgentApprovalActionType): ApprovalQueueCategory {
  switch (actionType) {
    case "send_onboarding_email":
      return "onboarding";
    case "send_rent_chase_email":
      return "rent_chase";
    case "send_move_in_email":
      return "move_in";
    case "approve_maintenance_dispatch":
      return "maintenance";
  }
}

function formatApprovalQueueAgeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute";
  if (mins < 60) return `${mins} minutes`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour";
  if (hours < 48) return `${hours} hours`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day";
  return `${days} days`;
}

/** Day-of-month (1–31) for recurring rent, inferred from tenancy start_date. */
function rentDueDayOfMonthFromStartDate(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const d = new Date(`${String(startDate).trim()}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCDate();
}

const ONBOARDING_ORDER = [
  "not_started",
  "pending",
  "in_progress",
  "references",
  "referencing_requested",
  "contract_draft",
  "contract_sent",
  "pending_signature",
  "signed",
  "complete",
  "active",
] as const;

export function isStepAlreadyDone(currentStatus: string, stepStatus: string): boolean {
  const currentIdx = ONBOARDING_ORDER.indexOf(currentStatus as typeof ONBOARDING_ORDER[number]);
  const stepIdx = ONBOARDING_ORDER.indexOf(stepStatus as typeof ONBOARDING_ORDER[number]);
  if (currentIdx === -1 || stepIdx === -1) return false;
  return currentIdx >= stepIdx;
}

async function logAgentActivity(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  result: Record<string, unknown>,
  success: boolean,
) {
  const { error } = await supabase.from("agent_activity").insert({
    user_id: userId,
    tool_name: toolName,
    source: "assistant",
    args: toolArgs,
    result,
    success,
    created_at: new Date().toISOString(),
  });
  if (error) console.error("[agent_activity] log failed:", error);
}

async function saveEmailDraft(
  supabase: SupabaseClient,
  userId: string,
  params: {
    subject: string;
    body: string;
    tenantId?: string | null;
    tenancyId?: string | null;
    status?: string;
  },
) {
  console.log("[email insert] user_id:", userId, "table: email_drafts");
  const { error } = await supabase.from("email_drafts").insert({
    user_id: userId,
    subject: params.subject,
    body: params.body,
    tenant_id: params.tenantId ?? null,
    tenancy_id: params.tenancyId ?? null,
    status: params.status ?? "draft",
  });
  if (error) console.error("[email_drafts] insert failed:", error);
}

function normalizeTenancyRows(tenancies: unknown): {
  id?: string | null;
  property_id?: string | null;
  status?: string | null;
}[] {
  if (Array.isArray(tenancies)) {
    return tenancies as { id?: string | null; property_id?: string | null; status?: string | null }[];
  }
  if (tenancies && typeof tenancies === "object") {
    return [tenancies as { id?: string | null; property_id?: string | null; status?: string | null }];
  }
  return [];
}

function unwrapTenancyProperty(row: { properties?: unknown }): {
  address?: string | null;
  city?: string | null;
} | null {
  const p = row.properties as unknown;
  const o = Array.isArray(p) ? p[0] : p;
  return o && typeof o === "object" ? (o as { address?: string | null; city?: string | null }) : null;
}

async function fetchAccountPropertyCount(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase.from("properties").select("id").eq("user_id", userId);
  return data?.length ?? 0;
}

/** YYYY-MM-DD in UTC — aligns with ISO date strings from Postgres `date` columns. */
function utcTodayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

type ComplianceDbRow = {
  id: string;
  property_id: string;
  type: string;
  expiry_date: string | null;
  status: string;
};

/** Legal/safety certificates: issue = expired status or expiry_date before today (not undated/missing-only). */
function isComplianceIssueRow(row: ComplianceDbRow, todayYmd: string): boolean {
  if (row.status === "expired") return true;
  if (!row.expiry_date) return false;
  const ed = String(row.expiry_date).slice(0, 10);
  return ed.length === 10 && ed < todayYmd;
}

async function fetchComplianceContextForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  propertyLabelById: Map<string, string>;
  records: Array<
    ComplianceDbRow & {
      property_address: string | null;
      is_compliance_issue: boolean;
      is_compliance_gap: boolean;
    }
  >;
  issue_count: number;
  /** Undated certificates (status missing) — remind to add dates / documents. */
  gap_count: number;
  expiring_count: number;
  valid_count: number;
}> {
  const { data: props } = await supabase
    .from("properties")
    .select("id, address, city")
    .eq("user_id", userId);
  const propertyLabelById = new Map<string, string>();
  for (const p of props ?? []) {
    const id = String((p as { id: string }).id);
    const addr = String((p as { address?: string | null }).address ?? "").trim();
    const city = String((p as { city?: string | null }).city ?? "").trim();
    const label = [addr, city].filter(Boolean).join(", ") || "";
    propertyLabelById.set(id, label);
  }
  const propertyIds = [...propertyLabelById.keys()];
  if (propertyIds.length === 0) {
    return {
      propertyLabelById,
      records: [],
      issue_count: 0,
      gap_count: 0,
      expiring_count: 0,
      valid_count: 0,
    };
  }

  const { data: rawRows } = await supabase
    .from("compliance_records")
    .select("id, property_id, type, expiry_date, status")
    .in("property_id", propertyIds);

  const todayYmd = utcTodayYmd();
  const rows: Array<
    ComplianceDbRow & {
      property_address: string | null;
      is_compliance_issue: boolean;
      is_compliance_gap: boolean;
    }
  > = [];
  let issue_count = 0;
  let gap_count = 0;
  let expiring_count = 0;
  let valid_count = 0;

  for (const r of rawRows ?? []) {
    const rawExp = (r as { expiry_date?: string | null }).expiry_date;
    const expiry_date =
      rawExp == null || rawExp === "" ? null : String(rawExp).slice(0, 10);
    const row: ComplianceDbRow = {
      id: String((r as { id: string }).id),
      property_id: String((r as { property_id: string }).property_id),
      type: String((r as { type?: string }).type ?? ""),
      expiry_date,
      status: String((r as { status?: string }).status ?? ""),
    };
    const property_address = propertyLabelById.get(row.property_id) ?? null;
    const is_compliance_issue = isComplianceIssueRow(row, todayYmd);
    const is_compliance_gap = row.status === "missing";
    rows.push({ ...row, property_address, is_compliance_issue, is_compliance_gap });
    if (is_compliance_issue) issue_count += 1;
    else if (is_compliance_gap) gap_count += 1;
    else if (row.status === "expiring") expiring_count += 1;
    else valid_count += 1;
  }

  return { propertyLabelById, records: rows, issue_count, gap_count, expiring_count, valid_count };
}

type TenancyRowForOnboarding = {
  id: string;
  property_id?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  monthly_rent?: number | string | null;
  deposit_amount?: number | string | null;
  onboarding_status?: string | null;
  tenants?: unknown;
  properties?: unknown;
};

/** When nested `properties` is missing, load labels by tenancy.property_id (no user_id filter on properties). */
async function enrichTenancyRowsWithPropertyDetails(
  supabase: SupabaseClient,
  rows: TenancyRowForOnboarding[],
): Promise<TenancyRowForOnboarding[]> {
  const missing = rows.filter((r) => !unwrapTenancyProperty(r) && r.property_id);
  if (missing.length === 0) return rows;
  const uniqueIds = [...new Set(missing.map((r) => String(r.property_id)))];
  const { data: props } = await supabase
    .from("properties")
    .select("id, address, city")
    .in("id", uniqueIds);
  const pm = new Map((props ?? []).map((p) => [String((p as { id: string }).id), p]));
  return rows.map((r) => {
    if (unwrapTenancyProperty(r)) return r;
    const pid = r.property_id;
    if (!pid) return r;
    const p = pm.get(String(pid));
    if (!p) return r;
    const row = p as { address?: string | null; city?: string | null };
    return {
      ...r,
      properties: {
        address: row.address ?? null,
        city: row.city ?? null,
      },
    };
  });
}

function mapTenancyCandidate(r: TenancyRowForOnboarding) {
  const p = unwrapTenancyProperty(r);
  return {
    tenancy_id: r.id,
    status: r.status ?? null,
    address: p?.address ?? null,
    city: p?.city ?? null,
  };
}

type PickTenancyForOnboardingResult =
  | { status: "picked"; tenancy_id: string }
  | {
      status: "ambiguous";
      candidates: ReturnType<typeof mapTenancyCandidate>[];
    }
  | { status: "fallback_confirm"; tenancy_id: string; property_label: string }
  | { status: "fall_through"; candidates: ReturnType<typeof mapTenancyCandidate>[] };

/**
 * Pick a single tenancy for onboarding: optional address/city hint, then prefer active when ambiguous.
 */
function pickTenancyForOnboarding(
  rows: TenancyRowForOnboarding[],
  propertyHint: string | undefined,
  accountPropertyCount: number,
): PickTenancyForOnboardingResult {
  let work = rows;
  const hint = propertyHint?.trim();
  if (hint) {
    const mapped: PropertyRowForMatch[] = rows
      .map((r) => {
        const p = unwrapTenancyProperty(r);
        if (!p) return null;
        return {
          id: String(r.id),
          address: p.address ?? null,
          city: p.city ?? null,
        };
      })
      .filter((x): x is PropertyRowForMatch => x !== null);
    const resolved = resolvePropertyRowsForDraftHint(mapped, hint, accountPropertyCount);
    if (resolved.kind === "matched_by_fallback") {
      const row = rows.find((r) => String(r.id) === resolved.row.id);
      const p = row ? unwrapTenancyProperty(row) : null;
      const propertyLabel =
        [p?.address, p?.city].filter(Boolean).join(", ") || "your property";
      return {
        status: "fallback_confirm",
        tenancy_id: resolved.row.id,
        property_label: propertyLabel,
      };
    }
    if (resolved.kind === "ambiguous_match") {
      const ids = new Set(resolved.candidates.map((c) => c.id));
      const narrowed = rows.filter((r) => ids.has(String(r.id)));
      return { status: "ambiguous", candidates: narrowed.map(mapTenancyCandidate) };
    }
    if (resolved.kind === "matched") {
      work = rows.filter((r) => String(r.id) === resolved.row.id);
    } else {
      work = rows;
    }
  }
  const active = work.filter((r) => (r.status ?? "").toLowerCase() === "active");
  const pool = active.length ? active : work;
  if (pool.length === 1) {
    return { status: "picked", tenancy_id: pool[0]!.id };
  }
  if (pool.length === 0) {
    return { status: "fall_through", candidates: rows.map(mapTenancyCandidate) };
  }
  return {
    status: "ambiguous",
    candidates: pool.map(mapTenancyCandidate),
  };
}

type DraftContractTenancyBundle = {
  tenantRow: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  resolvedTenancyId: string;
  tenancyData: {
    start_date: string | null;
    end_date: string | null;
    monthly_rent: number | string | null;
    deposit_amount: number | string | null;
    property_id: string;
    onboarding_status: string | null;
  };
  propertyLabel: string;
};

/**
 * When there are **no** `tenancies` rows (or tenant resolve failed) but the landlord has both a
 * **tenants** row and a **properties** row — same as dashboard “New contract” without a tenancy link.
 */
async function resolveDraftContractByTenantAndPropertyWithoutTenancy(
  supabase: SupabaseClient,
  userId: string,
  propertyHint: string,
  tenantNameFragment: string,
  accountPropertyCount: number,
): Promise<{ ok: true; data: DraftContractTenancyBundle } | { ok: false; json: string }> {
  /** Loads this landlord’s properties only; hint matching is case-insensitive in `resolvePropertyRowsForDraftHint` (address + city), not DB `ilike`. */
  const { data: propRows, error: propFetchErr } = await supabase
    .from("properties")
    .select("id, address, city, monthly_rent")
    .eq("user_id", userId);

  console.log("[property lookup] hint:", propertyHint.trim(), "userId:", userId, "results:", propRows?.length, "error:", propFetchErr?.message);

  const mapped: PropertyRowForMatch[] = (propRows ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    address: (r as { address?: string | null }).address ?? null,
    city: (r as { city?: string | null }).city ?? null,
  }));

  const resolved = resolvePropertyRowsForDraftHint(mapped, propertyHint.trim(), accountPropertyCount);

  if (resolved.kind === "matched_by_fallback") {
    const label =
      [resolved.row.address, resolved.row.city].filter(Boolean).join(", ") || "your property";
    return {
      ok: false,
      json: JSON.stringify({
        code: "matched_by_fallback",
        message: `I found one property — ${label}. Is this the right one?`,
        property: {
          property_id: resolved.row.id,
          address: resolved.row.address,
          city: resolved.row.city,
        },
        matched_by_fallback: true,
      }),
    };
  }

  if (resolved.kind === "ambiguous_match") {
    return {
      ok: false,
      json: JSON.stringify({
        code: "ambiguous_match",
        message: "I found a few possible properties — which one did you mean?",
        candidates: resolved.candidates.map((p) => ({
          property_id: p.id,
          address: p.address,
          city: p.city,
        })),
      }),
    };
  }

  if (resolved.kind === "no_property_match") {
    return {
      ok: false,
      json: JSON.stringify({
        code: "no_property_match",
        message:
          "I couldn't find a matching property. Can you confirm the exact address or check your Properties section?",
        reason: resolved.reason,
        ...(tenantNameFragment ? { tenant_name: tenantNameFragment } : {}),
      }),
    };
  }

  const matchedRow = resolved.row;
  const prop = propRows?.find((r) => String((r as { id: string }).id) === matchedRow.id) as
    | {
        id: string;
        address: string | null;
        city: string | null;
        monthly_rent: number | string | null;
      }
    | undefined;
  if (!prop) {
    return {
      ok: false,
      json: JSON.stringify({
        code: "internal",
        error: "Matched property row could not be reloaded.",
      }),
    };
  }

  const fragment = sanitizeIlikeNameFragment(tenantNameFragment);
  if (!fragment) {
    return {
      ok: false,
      json: JSON.stringify({
        error: "Pass a tenant name that matches a profile on your account.",
        code: "missing_tenant",
      }),
    };
  }

  const { data: tenantRows, error: nameErr } = await supabase
    .from("tenants")
    .select("id, full_name, email, phone")
    .eq("user_id", userId)
    .ilike("full_name", `%${fragment}%`)
    .limit(8);

  if (nameErr) {
    return {
      ok: false,
      json: JSON.stringify({ error: `Could not search tenants: ${nameErr.message}`, code: "internal" }),
    };
  }
  if (!tenantRows?.length) {
    return {
      ok: false,
      json: JSON.stringify({
        error:
          "No tenant profile matched that name. Call list_tenants or use the exact name as in the dashboard.",
        code: "tenant_not_found",
      }),
    };
  }
  if (tenantRows.length > 1) {
    return {
      ok: false,
      json: JSON.stringify({
        error: "Multiple tenants matched that name — pass tenant_id from list_tenants.",
        code: "multiple_tenants",
        candidates: tenantRows.map((r) => ({ id: r.id, full_name: r.full_name })),
      }),
    };
  }

  const tp = tenantRows[0] as {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  const mr = Number(prop.monthly_rent ?? 0) || 0;
  const propertyLabel = [prop.address, prop.city].filter(Boolean).join(", ") || "Property";

  return {
    ok: true,
    data: {
      tenantRow: tp,
      resolvedTenancyId: "",
      tenancyData: {
        start_date: null,
        end_date: null,
        monthly_rent: prop.monthly_rent,
        deposit_amount: mr > 0 ? mr : null,
        property_id: String(prop.id),
        onboarding_status: "contract_sent",
      },
      propertyLabel,
    },
  };
}

/** When the user gives a street (e.g. “101 Billionaires Row”) but the model omits tenant_name. */
async function resolveDraftContractByPropertyHint(
  supabase: SupabaseClient,
  userId: string,
  hint: string,
  optionalTenantName: string | null,
): Promise<{ ok: true; data: DraftContractTenancyBundle } | { ok: false; json: string }> {
  const { data: propCountRows } = await supabase.from("properties").select("id").eq("user_id", userId);
  const accountPropertyCount = propCountRows?.length ?? 0;

  /** Scope by tenant profile ownership — do not filter properties by user_id (property row may not match). */
  const { data: tenRows } = await supabase
    .from("tenancies")
    .select(
      `id, status, start_date, end_date, monthly_rent, deposit_amount, property_id, onboarding_status, tenants!inner ( id, full_name, email, phone, user_id ), properties ( address, city )`,
    )
    .eq("tenants.user_id", userId);

  const owned = await enrichTenancyRowsWithPropertyDetails(supabase, (tenRows ?? []) as TenancyRowForOnboarding[]);

  const mapped: PropertyRowForMatch[] = owned
    .map((r) => {
      const p = unwrapTenancyProperty(r as TenancyRowForOnboarding);
      if (!p) return null;
      return {
        id: String(r.id),
        address: p.address ?? null,
        city: p.city ?? null,
      };
    })
    .filter((x): x is PropertyRowForMatch => x !== null);

  const resolved = resolvePropertyRowsForDraftHint(mapped, hint, accountPropertyCount);

  if (resolved.kind === "matched_by_fallback") {
    const label =
      [resolved.row.address, resolved.row.city].filter(Boolean).join(", ") || "your property";
    return {
      ok: false,
      json: JSON.stringify({
        code: "matched_by_fallback",
        message: `I found one property — ${label}. Is this the right one?`,
        tenancy_id: resolved.row.id,
        matched_by_fallback: true,
      }),
    };
  }

  if (resolved.kind === "ambiguous_match") {
    const tidSet = new Set(resolved.candidates.map((c) => c.id));
    const tenancies = owned.filter((o) => tidSet.has(String(o.id)));
    return {
      ok: false,
      json: JSON.stringify({
        code: "ambiguous_match",
        message: "I found a few possible properties — which one did you mean?",
        candidates: tenancies.map((r) => mapTenancyCandidate(r as TenancyRowForOnboarding)),
      }),
    };
  }

  let hintPool: typeof owned = [];
  if (resolved.kind === "matched") {
    const row = owned.find((o) => String(o.id) === resolved.row.id);
    if (row) hintPool = [row];
  }

  let pool = hintPool;
  if (optionalTenantName?.trim()) {
    const frag = optionalTenantName.trim().toLowerCase();
    const words = frag.split(/\s+/).filter((w) => w.length >= 2);
    const nameFiltered = pool.filter((r) => {
      const tr = r.tenants as unknown as { full_name: string | null } | null | { full_name: string | null }[];
      const tp = Array.isArray(tr) ? tr[0] : tr;
      const fn = (tp?.full_name ?? "").toLowerCase();
      return fn.includes(frag) || (words.length > 0 && words.every((w) => fn.includes(w)));
    });
    if (nameFiltered.length > 0) {
      pool = nameFiltered;
    } else if (hintPool.length === 1) {
      // Single tenancy at this address — use it even if inferred/model name did not match DB spelling.
      pool = hintPool;
    } else if (hintPool.length > 1) {
      return {
        ok: false,
        json: JSON.stringify({
          error:
            "That address matched more than one tenancy — say which tenant (full name) or pick from the list.",
          code: "tenant_name_mismatch",
          candidates: hintPool.map((r) => mapTenancyCandidate(r as TenancyRowForOnboarding)),
        }),
      };
    }
  }

  if (pool.length === 0) {
    if (optionalTenantName?.trim()) {
      const noTenancyRow = await resolveDraftContractByTenantAndPropertyWithoutTenancy(
        supabase,
        userId,
        hint,
        optionalTenantName.trim(),
        accountPropertyCount,
      );
      if (noTenancyRow.ok) return noTenancyRow;
      return { ok: false, json: noTenancyRow.json };
    }
    return {
      ok: false,
      json: JSON.stringify({
        code: "no_property_match",
        message:
          "I couldn't find a matching property. Can you confirm the exact address or check your Properties section?",
        ...(optionalTenantName?.trim() ? { tenant_name: optionalTenantName.trim() } : {}),
      }),
    };
  }
  if (pool.length > 1) {
    return {
      ok: false,
      json: JSON.stringify({
        error:
          "Multiple tenancies matched that property — pass tenant_name or tenancy_id from list_tenants.",
        code: "ambiguous_tenancy",
        candidates: pool.map((r) => mapTenancyCandidate(r as TenancyRowForOnboarding)),
      }),
    };
  }

  const chosen = pool[0]!;
  const tr = chosen.tenants as unknown as
    | { id: string; full_name: string | null; email: string | null; phone: string | null }
    | { id: string; full_name: string | null; email: string | null; phone: string | null }[]
    | null;
  const tp = Array.isArray(tr) ? tr[0] : tr;
  if (!tp?.id) {
    return {
      ok: false,
      json: JSON.stringify({ error: "Tenancy has no tenant profile linked.", code: "invalid_tenancy" }),
    };
  }
  const tenancyPid = chosen.property_id as string | null | undefined;
  if (!tenancyPid) {
    return {
      ok: false,
      json: JSON.stringify({ error: "Tenancy has no property linked.", code: "invalid_tenancy" }),
    };
  }
  const { data: propertyRow, error: propertyError } = await supabase
    .from("properties")
    .select("id, address, postcode, city, property_type, bedrooms, bathrooms")
    .eq("id", tenancyPid)
    .single();
  console.log("[draft_contract] property:", JSON.stringify({ data: propertyRow, error: propertyError }));
  if (!propertyRow) {
    return {
      ok: false,
      json: JSON.stringify({
        success: false,
        message: `Property not found for this tenancy (property_id: ${tenancyPid})`,
        code: "not_found",
      }),
    };
  }
  const propertyLabel =
    [propertyRow.address, propertyRow.city, propertyRow.postcode].filter(Boolean).join(", ") || "Property";

  return {
    ok: true,
    data: {
      tenantRow: tp,
      resolvedTenancyId: String(chosen.id),
      tenancyData: {
        start_date: chosen.start_date as string | null,
        end_date: chosen.end_date as string | null,
        monthly_rent: chosen.monthly_rent as number | string | null,
        deposit_amount: chosen.deposit_amount as number | string | null,
        property_id: String(chosen.property_id),
        onboarding_status: chosen.onboarding_status as string | null,
      },
      propertyLabel,
    },
  };
}

const defaultSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface ToolCallArgs {
  month?: string;
  status?: string;
  tenant_name?: string;
  tenant_id?: string;
  property_id?: string;
  lead_id?: string;
  tenancy_id?: string;
  /** Resolve tenant by name then tenancy — use with start_tenant_onboarding (no UUIDs required). */
  onboarding_for?: string;
  onboarding_property_hint?: string;
  auto_create_tenant_and_tenancy?: boolean;
  start_date?: string;
  /** search_properties */
  query?: string;
  /** create_tenant_and_tenancy */
  property_query?: string;
  tenant_email?: string;
  monthly_rent?: string;
  limit?: string | number;
  issue_title?: string;
  issue_description?: string;
  contractor_name?: string;
  contractor_email?: string;
  dispatch_channel?: "email" | "sms" | "both";
  tone?: "premium" | "family" | "student" | "investor";
  target_channel?: "rightmove" | "zoopla" | "generic";
  save_to_property?: boolean;
  /** From tool input (strings). */
  step?: string;
  decision?: string;
  /** draft_contract — only when user explicitly forces */
  override?: boolean | string;
  /** send_contract */
  contract_id?: string;
  /** bulk_onboard_tenants */
  csv_text?: string;
  preview?: string;
}

function normalizePipelineStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function addOneYearIsoDate(startDateIso: string): string {
  const d = new Date(`${startDateIso.trim()}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setUTCFullYear(fallback.getUTCFullYear() + 1);
    return fallback.toISOString().slice(0, 10);
  }
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function displayLeadName(lead: { full_name?: string | null; name?: string | null }): string {
  const n = (lead.full_name ?? lead.name ?? "").trim();
  return n || "Unknown lead";
}

function appendLeadNote(prev: string | null | undefined, line: string): string {
  const p = (prev ?? "").trim();
  const day = new Date().toISOString().slice(0, 10);
  const block = `[${day}] ${line}`;
  return p ? `${p}\n\n${block}` : block;
}

function classifyMaintenanceCategory(desc: string): {
  category: "plumbing" | "electrical" | "heating" | "structural" | "general";
  priority: "urgent" | "standard";
} {
  const t = desc.toLowerCase();
  const urgent =
    /\b(gas|smoke|fire|flood|burst|no\s+heat|no\s+heating|electrical\s+burn|sparks?|shock|ceiling\s+collapse)\b/.test(
      t,
    ) || /\burgent|emergency|immediately|asap\b/.test(t);
  if (/\b(pipe|leak|toilet|drain|plumb)\b/.test(t)) {
    return { category: "plumbing", priority: urgent ? "urgent" : "standard" };
  }
  if (/\b(electric|socket|power|lighting|fuse|breaker|wire)\b/.test(t)) {
    return { category: "electrical", priority: urgent ? "urgent" : "standard" };
  }
  if (/\b(boiler|radiator|heating|thermostat|hot\s+water)\b/.test(t)) {
    return { category: "heating", priority: urgent ? "urgent" : "standard" };
  }
  if (/\b(roof|wall|window|door|crack|damp|mould|mold)\b/.test(t)) {
    return { category: "structural", priority: urgent ? "urgent" : "standard" };
  }
  return { category: "general", priority: urgent ? "urgent" : "standard" };
}

function parseBoolArg(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}

async function resolveTenancyIdForReferencingHandoff(
  supabase: SupabaseClient,
  userId: string,
  args: ToolCallArgs,
): Promise<{ ok: true; tenancyId: string } | { ok: false; response: string }> {
  const tenancyIdArg = args.tenancy_id?.trim();
  const tenantIdArg = args.tenant_id?.trim();
  const tenantNameArg = args.tenant_name?.trim() ? sanitizeTenantName(args.tenant_name.trim()) : undefined;

  if (tenancyIdArg) {
    const { data: tenancy, error: tErr } = await supabase
      .from("tenancies")
      .select(`id, properties!inner ( user_id )`)
      .eq("id", tenancyIdArg)
      .maybeSingle();
    if (tErr || !tenancy) {
      return { ok: false, response: JSON.stringify({ error: "Tenancy not found." }) };
    }
    const prop = tenancy.properties as unknown as { user_id: string };
    if (prop.user_id !== userId) {
      return { ok: false, response: JSON.stringify({ error: "Tenancy not found." }) };
    }
    return { ok: true, tenancyId: String(tenancy.id) };
  }

  if (!tenantIdArg && !tenantNameArg) {
    return {
      ok: false,
      response: JSON.stringify({
        error:
          "Pass tenancy_id, or tenant_id (tenant profile UUID), or tenant_name to send the referencing handoff.",
      }),
    };
  }

  let resolvedTenantId: string | null = null;

  if (tenantIdArg) {
    if (!looksLikeUuid(tenantIdArg)) {
      return {
        ok: false,
        response: JSON.stringify({
          error: "tenant_id must be a tenant profile UUID from list_tenants. Use tenant_name for a name.",
        }),
      };
    }
    const { data: tp } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenantIdArg)
      .eq("user_id", userId)
      .maybeSingle();
    if (!tp) {
      return { ok: false, response: JSON.stringify({ error: "Tenant not found." }) };
    }
    resolvedTenantId = tp.id as string;
  } else if (tenantNameArg) {
    const tenantResolved = await resolveTenantProfileForAccount(supabase, userId, tenantNameArg);
    if (!tenantResolved.ok) {
      const body = tenantResolved.body;
      if (Array.isArray(body.candidates)) {
        return {
          ok: false,
          response: JSON.stringify({
            error:
              typeof body.error === "string"
                ? body.error
                : "Multiple tenants matched — ask which one or use tenant_id from list_tenants.",
            code: "multiple_tenants",
            candidates: body.candidates,
          }),
        };
      }
      return {
        ok: false,
        response: JSON.stringify({
          error: typeof body.error === "string" ? body.error : "Could not resolve tenant.",
        }),
      };
    }
    resolvedTenantId = tenantResolved.tenantId;
  }

  if (!resolvedTenantId) {
    return {
      ok: false,
      response: JSON.stringify({ error: "Could not resolve a tenant." }),
    };
  }

  const { data: tenRows } = await supabase
    .from("tenancies")
    .select(`id, status, tenants ( full_name ), properties!inner ( user_id, address, city )`)
    .eq("tenant_id", resolvedTenantId);

  const owned = (tenRows ?? []).filter((r) => {
    const p = r.properties as unknown as { user_id: string };
    return p.user_id === userId;
  });

  if (owned.length === 0) {
    return {
      ok: false,
      response: JSON.stringify({
        error: "No tenancy found for this tenant on your account.",
      }),
    };
  }

  if (owned.length === 1) {
    return { ok: true, tenancyId: String(owned[0]!.id) };
  }

  const poolForPick = owned.map((r) => ({
    id: r.id as string,
    status: r.status as string | null | undefined,
    properties: r.properties,
  })) as TenancyRowForOnboarding[];

  const picked = pickTenancyForOnboarding(poolForPick, undefined, 0);
  if (picked.status === "picked" || picked.status === "fallback_confirm") {
    return { ok: true, tenancyId: picked.tenancy_id };
  }

  const hrefFor = (id: string) => `/dashboard/tenancies/${id}`;
  const candidates = owned.map((r) => {
    const p = r.properties as unknown as { address: string | null; city: string | null };
    const addr = [p.address, p.city].filter(Boolean).join(", ") || "Property";
    const tr = r.tenants as unknown as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    const tn = Array.isArray(tr) ? tr[0] : tr;
    const name = tn?.full_name?.trim() || "Tenant";
    const tid = String(r.id);
    return {
      tenancy_id: tid,
      label: `${name} · ${addr.slice(0, 80)}`,
      href: hrefFor(tid),
    };
  });

  return {
    ok: false,
    response: JSON.stringify({
      ok: false,
      code: "multiple_tenancies",
      message: "Multiple tenancies for this tenant — pick one.",
      candidates,
    }),
  };
}

export async function executeCEOTool(
  toolName: CEOToolName,
  rawArgs: ToolCallArgs,
  userId: string,
  supabase: SupabaseClient = defaultSupabase,
): Promise<string> {
  console.log(`[executor] executeCEOTool start: ${toolName}`, { rawArgs, userId });
  const args = normalizeCEOToolInput(rawArgs as unknown as Record<string, unknown>) as unknown as ToolCallArgs;

  switch (toolName) {
    case "get_dashboard_summary": {
      const [properties, tenants, maintenance, rentPayments, complianceCtx] = await Promise.all([
        supabase.from("properties").select("id, address").eq("user_id", userId),
        supabase.from("tenants").select("id").eq("user_id", userId),
        supabase.from("maintenance_requests").select("id, title, status, priority").eq("user_id", userId),
        supabase.from("rent_payments").select("id, amount, status, due_date").eq("user_id", userId),
        fetchComplianceContextForUser(supabase, userId),
      ]);
      const overdueRent = rentPayments.data?.filter((r) => r.status === "overdue") ?? [];
      const openMaintenance = maintenance.data?.filter((m) => m.status !== "completed") ?? [];
      const compliance_issues_preview = complianceCtx.records
        .filter((r) => r.is_compliance_issue)
        .slice(0, 12)
        .map((r) => ({
          type: r.type,
          property_address: r.property_address,
          expiry_date: r.expiry_date,
          status: r.status,
        }));
      const compliance_gaps_preview = complianceCtx.records
        .filter((r) => r.is_compliance_gap)
        .slice(0, 12)
        .map((r) => ({
          type: r.type,
          property_address: r.property_address,
          status: r.status,
        }));
      return JSON.stringify({
        total_properties: properties.data?.length ?? 0,
        total_tenants: tenants.data?.length ?? 0,
        active_tenants: tenants.data?.length ?? 0,
        overdue_rent_count: overdueRent.length,
        overdue_rent_total: overdueRent.reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
        open_maintenance: openMaintenance.length,
        urgent_maintenance: maintenance.data?.filter((m) => m.priority === "urgent").length ?? 0,
        compliance_records_total: complianceCtx.records.length,
        compliance_issue_count: complianceCtx.issue_count,
        compliance_gap_count: complianceCtx.gap_count,
        compliance_expiring_soon_count: complianceCtx.expiring_count,
        compliance_valid_count: complianceCtx.valid_count,
        compliance_issues_preview,
        compliance_gaps_preview,
        compliance_note:
          "Compliance (EPC, Gas Safety, Electric Safety) is stored in compliance_records per property — not the same as maintenance repairs. For compliance questions, prioritize this section and get_compliance_summary.",
      });
    }
    case "get_compliance_summary": {
      const ctx = await fetchComplianceContextForUser(supabase, userId);
      const todayYmd = utcTodayYmd();
      return JSON.stringify({
        ok: true,
        authoritative_date_today_ymd: todayYmd,
        summary: {
          total_records: ctx.records.length,
          compliance_issue_count: ctx.issue_count,
          compliance_gap_count: ctx.gap_count,
          expiring_within_30_days_count: ctx.expiring_count,
          valid_count: ctx.valid_count,
        },
        definition:
          "A compliance issue means status is 'expired' OR expiry_date is before today. A gap means status is 'missing' (no expiry date yet). Maintenance tickets are separate.",
        records: ctx.records.map((r) => ({
          id: r.id,
          property_id: r.property_id,
          property_address: r.property_address,
          certificate_type: r.type,
          expiry_date: r.expiry_date,
          status: r.status,
          is_compliance_issue: r.is_compliance_issue,
          is_compliance_gap: r.is_compliance_gap,
        })),
      });
    }
    case "get_rent_status": {
      const month = args.month?.trim() ?? new Date().toISOString().slice(0, 7);
      const tenancyIdArg = args.tenancy_id?.trim();
      const tenantNameArg = args.tenant_name?.trim() ? sanitizeTenantName(args.tenant_name.trim()) : undefined;

      const { data: payments } = await supabase
        .from("rent_payments")
        .select(
          "id, amount, status, due_date, tenant_id, tenancy_id, property_id, tenants(full_name, email)",
        )
        .eq("user_id", userId)
        .gte("due_date", `${month}-01`)
        .lte("due_date", `${month}-31`);

      let tenantIdFilter: string[] | null = null;
      let noTenancyMatch = false;
      if (tenantNameArg && !tenancyIdArg) {
        const frag = sanitizeIlikeNameFragment(tenantNameArg);
        if (frag) {
          const { data: nameHits } = await supabase
            .from("tenants")
            .select("id")
            .eq("user_id", userId)
            .ilike("full_name", `%${frag}%`);
          tenantIdFilter = [...new Set((nameHits ?? []).map((r) => r.id as string))];
          if (tenantIdFilter.length === 0) {
            noTenancyMatch = true;
          }
        }
      }

      let tenRows: Record<string, unknown>[] | null = null;
      if (noTenancyMatch) {
        tenRows = [];
      } else {
        let tenancyQuery = supabase
          .from("tenancies")
          .select(
            `
          id,
          tenant_id,
          property_id,
          start_date,
          end_date,
          move_in_date,
          monthly_rent,
          deposit_amount,
          status,
          tenants!inner ( id, full_name ),
          properties!inner ( address, city, user_id )
        `,
          )
          .eq("properties.user_id", userId);

        if (tenancyIdArg) {
          tenancyQuery = tenancyQuery.eq("id", tenancyIdArg);
        } else if (tenantIdFilter && tenantIdFilter.length === 1) {
          tenancyQuery = tenancyQuery.eq("tenant_id", tenantIdFilter[0]);
        } else if (tenantIdFilter && tenantIdFilter.length > 1) {
          tenancyQuery = tenancyQuery.in("tenant_id", tenantIdFilter);
        }

        const { data } = await tenancyQuery.order("created_at", { ascending: false });
        tenRows = data ?? [];
      }

      type TenancySnap = {
        tenancy_id: string;
        tenant_name: string | null;
        property_address: string | null;
        monthly_rent: number | null;
        start_date: string | null;
        end_date: string | null;
        move_in_date: string | null;
        tenancy_status: string | null;
        rent_due_day_of_month: number | null;
        rent_schedule_hint: string | null;
        first_payment_record: {
          id: string;
          due_date: string | null;
          amount: number | null;
          status: string | null;
        } | null;
      };

      const tenancies: TenancySnap[] = [];

      for (const row of tenRows ?? []) {
        const traw = row.tenants as unknown;
        const t = Array.isArray(traw) ? traw[0] : traw;
        const tenantName =
          t && typeof t === "object" && "full_name" in t
            ? String((t as { full_name?: string | null }).full_name ?? "").trim() || null
            : null;

        const praw = row.properties as unknown;
        const p = Array.isArray(praw) ? praw[0] : praw;
        const addr =
          p && typeof p === "object" && "address" in p
            ? [
                String((p as { address?: string | null }).address ?? "").trim(),
                String((p as { city?: string | null }).city ?? "").trim(),
              ]
                .filter(Boolean)
                .join(", ") || null
            : null;

        const startDate = (row as { start_date?: string | null }).start_date ?? null;
        const dueDay = rentDueDayOfMonthFromStartDate(startDate);
        const tid = String((row as { id: string }).id);

        let firstPayment: TenancySnap["first_payment_record"] = null;
        const { data: fp } = await supabase
          .from("rent_payments")
          .select("id, due_date, amount, status")
          .eq("user_id", userId)
          .eq("tenancy_id", tid)
          .order("due_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        const mapFp = (raw: Record<string, unknown>): TenancySnap["first_payment_record"] => ({
          id: raw.id as string,
          due_date: (raw.due_date as string | null | undefined) ?? null,
          amount:
            raw.amount == null ? null : Number(raw.amount as number | string),
          status: String((raw.status as string | null | undefined) ?? ""),
        });

        if (fp) {
          firstPayment = mapFp(fp as Record<string, unknown>);
        } else {
          const tId = (row as { tenant_id?: string | null }).tenant_id;
          const pId = (row as { property_id?: string | null }).property_id;
          if (tId && pId) {
            const { data: fpAlt } = await supabase
              .from("rent_payments")
              .select("id, due_date, amount, status")
              .eq("user_id", userId)
              .eq("tenant_id", tId)
              .eq("property_id", pId)
              .order("due_date", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (fpAlt) {
              firstPayment = mapFp(fpAlt as Record<string, unknown>);
            }
          }
        }

        const mr = (row as { monthly_rent?: number | string | null }).monthly_rent;
        tenancies.push({
          tenancy_id: tid,
          tenant_name: tenantName,
          property_address: addr,
          monthly_rent: mr == null ? null : Number(mr),
          start_date: startDate,
          end_date: (row as { end_date?: string | null }).end_date ?? null,
          move_in_date: (row as { move_in_date?: string | null }).move_in_date ?? null,
          tenancy_status: (row as { status?: string | null }).status ?? null,
          rent_due_day_of_month: dueDay,
          rent_schedule_hint:
            dueDay != null
              ? `Recurring rent is typically due on day ${dueDay} of each month (from tenancy start date in Letora).`
              : startDate
                ? null
                : "Tenancy start date is not set in Letora — add it on the tenancy page for a full schedule.",
          first_payment_record: firstPayment,
        });
      }

      let ambiguity_note: string | null = null;
      if (tenantNameArg && !tenancyIdArg && tenancies.length > 1) {
        ambiguity_note =
          "Multiple tenancy rows match that tenant name — ask which property or pass tenancy_id from list_tenants.";
      }
      if (tenantNameArg && !tenancyIdArg && tenancies.length === 0) {
        ambiguity_note =
          "No tenancy row found for that tenant on your account. They can confirm details on the tenancy page.";
      }

      const payList = payments ?? [];
      return JSON.stringify({
        month,
        payments: payList,
        paid: payList.filter((p) => p.status === "paid").length,
        overdue: payList.filter((p) => p.status === "overdue").length,
        total_expected: payList.reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
        total_collected: payList
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
        tenancies,
        ...(ambiguity_note ? { ambiguity_note } : {}),
        authoritative_tenancy_note:
          "Answer rent amount, first payment, due day, and schedule from **tenancies** when present. Do not claim missing tenancy start date or monthly rent when **tenancies** includes start_date or monthly_rent.",
      });
    }
    case "chase_rent": {
      const rawMonth = typeof args.month === "string" ? args.month.trim() : "";
      const explicitMonth = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : undefined;
      const rawTenantId = typeof args.tenant_id === "string" ? args.tenant_id.trim() : "";
      const rawTenantName =
        typeof args.tenant_name === "string" ? sanitizeTenantName(args.tenant_name.trim()) : "";

      let scopedTenantId: string | undefined;
      if (rawTenantId || rawTenantName) {
        const lookupKey = rawTenantId || rawTenantName;
        const resolved = await resolveTenantProfileForAccount(supabase, userId, lookupKey);
        if (resolved.ok === false) {
          return JSON.stringify({
            month: explicitMonth ?? null,
            month_scope: explicitMonth ? "calendar_due_month" : "all_chaseable",
            chased: 0,
            results: [],
            ...resolved.body,
          });
        }
        scopedTenantId = resolved.tenantId;
      }

      const results = await runRentChaserAgent(userId, {
        supabase,
        ...(explicitMonth ? { month: explicitMonth } : {}),
        source: "ceo_assistant",
        ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
      });
      if (results.length === 0) {
        return JSON.stringify({
          month: explicitMonth ?? null,
          month_scope: explicitMonth ? "calendar_due_month" : "all_chaseable",
          message:
            "No bulk rent-chase set was created for this period. Check individual overdue tenancies before deciding next action.",
          chased: 0,
          results: [],
        });
      }

      // Each chase now creates its own email draft record inside runRentChaserAgent
      // to ensure stable IDs and linking to Approvals.

      return JSON.stringify({
        month: explicitMonth ?? null,
        month_scope: explicitMonth ? "calendar_due_month" : "all_chaseable",
        message: `Processed ${results.length} rent chase run(s). Chase emails need approval in Approvals before they send (one email per approval).`,
        chased: results.length,
        results: results.map((r) => ({
          tenant_name: r.tenantName,
          tenant_email: r.tenantEmail,
          property_address: r.propertyAddress,
          amount_owed: r.amountOwed,
          days_overdue: r.daysOverdue,
          email_subject: r.emailSubject,
          email_sent: r.emailSent ?? false,
          agent_run_id: r.actionId,
        })),
      });
    }
    case "get_maintenance_summary": {
      const statusFilter = args.status === "all" || !args.status ? null : args.status;
      let query = supabase
        .from("maintenance_requests")
        .select("id, title, description, status, priority, created_at, property_id, properties(address)")
        .eq("user_id", userId);
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data: tickets } = await query.order("created_at", { ascending: false }).limit(20);
      if (!tickets || tickets.length === 0) {
        return JSON.stringify({ message: "No maintenance tickets found.", tickets: [] });
      }
      const summary = await runLLM({
        agentName: "maintenance",
        messages: [
          {
            role: "system",
            content:
              "You are a maintenance triage assistant. Summarise the open maintenance tickets concisely, highlighting urgent issues first.",
          },
          {
            role: "user",
            content: `Summarise these maintenance tickets: ${JSON.stringify(tickets)}`,
          },
        ],
      });
      return JSON.stringify({
        total: tickets.length,
        urgent: tickets.filter((t) => t.priority === "urgent").length,
        summary: summary.text,
        tickets,
      });
    }
    case "get_leads_summary": {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, full_name, name, email, status, qualified_status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      const rows = leads ?? [];
      const byQualified = (q: string) => rows.filter((l) => (l.qualified_status ?? "").toLowerCase() === q).length;
      const byStatus = (s: string) => rows.filter((l) => (l.status ?? "").toLowerCase() === s).length;

      const recent = rows.slice(0, 8).map((l) => ({
        id: l.id,
        full_name: l.full_name ?? l.name ?? "Unknown",
        email: l.email ?? null,
        status: l.status ?? null,
        qualified_status: l.qualified_status ?? null,
        created_at: l.created_at ?? null,
      }));

      return JSON.stringify({
        total: rows.length,
        new: byStatus("new"),
        pending_qualification: byQualified("pending"),
        qualified: byQualified("qualified"),
        disqualified: byQualified("disqualified"),
        recent,
      });
    }
    case "get_pending_approvals_summary": {
      const { data, error } = await supabase
        .from("agent_approvals")
        .select("id,title,summary,action_type,created_at,status")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) {
        return JSON.stringify({ ok: false, error: error.message });
      }

      const pending = (data ?? []) as AgentApprovalRow[];
      const stats = computeApprovalQueueStats(pending);
      const by_category: Record<ApprovalQueueCategory, number> = {
        onboarding: 0,
        rent_chase: 0,
        move_in: 0,
        maintenance: 0,
        other: 0,
      };
      for (const row of pending) {
        const cat = categoryForApprovalActionType(row.action_type);
        by_category[cat] += 1;
      }
      const items = pending.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        category: categoryForApprovalActionType(row.action_type),
        created_at: row.created_at,
      }));

      return JSON.stringify({
        ok: true,
        pending_total: stats.pendingTotal,
        by_category,
        by_action_type: stats.byActionType,
        oldest_waiting_iso: stats.oldestPendingCreatedAt,
        oldest_waiting_label: formatApprovalQueueAgeLabel(stats.oldestPendingCreatedAt),
        stale_pending_count: stats.stalePendingCount,
        items,
        next_action: "Open /dashboard/approvals to approve, reject, or review full details.",
      });
    }
    case "search_properties": {
      const query = (args.query ?? "").trim();
      const rawLim = args.limit;
      const parsedLim =
        typeof rawLim === "number"
          ? rawLim
          : rawLim != null && String(rawLim).length > 0
            ? parseInt(String(rawLim), 10)
            : 15;
      const limit = Math.min(30, Math.max(1, Number.isFinite(parsedLim) ? parsedLim : 15));

      const { data: rows, error } = await supabase
        .from("properties")
        .select("id, address, city, postcode, monthly_rent")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(250);

      if (error) {
        return JSON.stringify({ error: error.message, candidates: [] });
      }

      const { candidates, hint } = rankPropertySearch(query, (rows ?? []) as PropertySearchRow[], limit);
      return JSON.stringify({
        query,
        candidates: candidates.map((r) => ({
          id: r.id,
          label: labelPropertyRow(r),
          address: r.address,
          city: r.city,
          postcode: r.postcode,
          monthly_rent: r.monthly_rent,
        })),
        hint,
        disambiguation:
          candidates.length > 1
            ? "Multiple properties matched — use city and monthly_rent to choose the correct **id** (full UUID), not a unit number alone."
            : null,
      });
    }
    case "create_tenant_and_tenancy": {
      const tenantName = sanitizeTenantName(args.tenant_name?.trim() ?? "");
      const tenantEmail = (args.tenant_email ?? "").trim().toLowerCase();
      const propertyIdArg = (args.property_id ?? "").trim();
      const propertyQuery = (args.property_query ?? "").trim();
      const startDate = (args.start_date ?? "").trim();
      const monthlyRentRaw = (args.monthly_rent ?? "").trim();

      const missingFields: string[] = [];
      if (!tenantName) missingFields.push("tenant_name");
      if (!tenantEmail) missingFields.push("tenant_email");
      if (!propertyIdArg && !propertyQuery) missingFields.push("property");
      if (!startDate) missingFields.push("start_date");
      if (!monthlyRentRaw) missingFields.push("monthly_rent");
      if (missingFields.length > 0) {
        return JSON.stringify({
          code: "missing_create_fields",
          error: "Missing required fields to create tenant and tenancy.",
          blocked_by: missingFields,
          message: `Ready to create once you provide: ${missingFields.join(", ")}.`,
          what_i_have: {
            tenant_name: tenantName || null,
            tenant_email: tenantEmail || null,
            property_id: propertyIdArg || null,
            property_query: propertyQuery || null,
            start_date: startDate || null,
            monthly_rent: monthlyRentRaw || null,
          },
        });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return JSON.stringify({
          code: "invalid_start_date",
          error: "Start date must be in YYYY-MM-DD format.",
          blocked_by: ["start_date"],
          message: "Ready to continue once you provide the start date in YYYY-MM-DD format.",
          what_i_have: { start_date: startDate },
        });
      }

      const monthlyRent = Number(monthlyRentRaw.replace(/,/g, ""));
      if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
        return JSON.stringify({
          code: "invalid_monthly_rent",
          error: "Monthly rent must be a positive number.",
          blocked_by: ["monthly_rent"],
          message: "Ready to continue once you confirm the monthly rent as a number.",
          what_i_have: { monthly_rent: monthlyRentRaw },
        });
      }

      let propertyId = propertyIdArg;
      let propertyLabel = "";
      if (propertyId) {
        const { data: propertyById } = await supabase
          .from("properties")
          .select("id, address, city")
          .eq("id", propertyId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!propertyById) {
          return JSON.stringify({
            code: "property_not_found",
            error: "I could not match that property on your account.",
            blocked_by: ["property"],
            message: "Ready to continue once you confirm the property address or postcode.",
          });
        }
        propertyLabel = [propertyById.address, propertyById.city].filter(Boolean).join(", ");
      } else {
        const { data: allProps } = await supabase
          .from("properties")
          .select("id, address, city, postcode, monthly_rent")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(250);
        const ranked = rankPropertySearch(propertyQuery, (allProps ?? []) as PropertySearchRow[], 5);
        if (ranked.candidates.length === 0) {
          return JSON.stringify({
            code: "property_not_found",
            error: "I could not match that property on your account.",
            blocked_by: ["property"],
            message: "Ready to continue once you confirm the property address or postcode.",
            what_i_have: { property_query: propertyQuery },
          });
        }
        if (ranked.candidates.length > 1) {
          return JSON.stringify({
            code: "property_ambiguous",
            error: "More than one property matches your request.",
            blocked_by: ["property_confirmation"],
            message: "Ready to continue once you confirm the correct property.",
            candidates: ranked.candidates.map((r) => ({
              id: r.id,
              label: labelPropertyRow(r),
              address: r.address,
              city: r.city,
              postcode: r.postcode,
            })),
          });
        }
        propertyId = ranked.candidates[0]!.id;
        propertyLabel = labelPropertyRow(ranked.candidates[0]!);
      }

      let tenantId: string;
      let createdTenant = false;
      const { data: byEmail } = await supabase
        .from("tenants")
        .select("id, full_name, email")
        .eq("user_id", userId)
        .eq("email", tenantEmail)
        .limit(2);
      if ((byEmail?.length ?? 0) > 1) {
        return JSON.stringify({
          code: "tenant_email_ambiguous",
          error: "More than one tenant profile uses this email address.",
          blocked_by: ["tenant_confirmation"],
          message: "Ready to continue once you confirm which tenant profile to use.",
          candidates: byEmail?.map((t) => ({ id: t.id, full_name: t.full_name, email: t.email })) ?? [],
        });
      }
      if (byEmail && byEmail.length === 1) {
        tenantId = byEmail[0]!.id as string;
      } else {
        const { data: byName } = await supabase
          .from("tenants")
          .select("id, full_name, email")
          .eq("user_id", userId)
          .ilike("full_name", tenantName)
          .limit(2);
        if ((byName?.length ?? 0) > 1) {
          return JSON.stringify({
            code: "tenant_name_ambiguous",
            error: "More than one tenant matches that name.",
            blocked_by: ["tenant_confirmation"],
            message: "Ready to continue once you confirm which tenant profile to use.",
            candidates: byName?.map((t) => ({ id: t.id, full_name: t.full_name, email: t.email })) ?? [],
          });
        }
        if (byName && byName.length === 1) {
          tenantId = byName[0]!.id as string;
          // Keep existing tenant but backfill email if missing.
          if (!String(byName[0]!.email ?? "").trim()) {
            await supabase
              .from("tenants")
              .update({ email: tenantEmail, updated_at: new Date().toISOString() })
              .eq("id", tenantId)
              .eq("user_id", userId);
          }
        } else {
          tenantId = crypto.randomUUID();
          const { error: tenantInsertErr } = await supabase.from("tenants").insert({
            id: tenantId,
            user_id: userId,
            full_name: tenantName,
            email: tenantEmail,
          });
          if (tenantInsertErr) {
            return JSON.stringify({
              code: "tenant_create_failed",
              error: `Could not create tenant profile: ${tenantInsertErr.message}`,
            });
          }
          createdTenant = true;
        }
      }

      const { data: existingTenancy } = await supabase
        .from("tenancies")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .eq("property_id", propertyId)
        .in("status", ["active", "in_progress", "pending"])
        .maybeSingle();

      let tenancyId: string;
      let createdTenancy = false;
      if (existingTenancy) {
        tenancyId = existingTenancy.id as string;
      } else {
        tenancyId = crypto.randomUUID();
        const endDate = addOneYearIsoDate(startDate);
        const { error: tenancyErr } = await supabase.from("tenancies").insert({
          id: tenancyId,
          property_id: propertyId,
          tenant_id: tenantId,
          start_date: startDate,
          end_date: endDate,
          monthly_rent: monthlyRent,
          deposit_amount: monthlyRent,
          status: "active",
        });
        if (tenancyErr) {
          return JSON.stringify({
            code: "tenancy_create_failed",
            error: `Could not create tenancy: ${tenancyErr.message}`,
          });
        }
        createdTenancy = true;
      }

      const onboarding = await runTenantOnboardingAgent(tenancyId, userId, supabase);
      return JSON.stringify({
        mode: "create_tenant_and_tenancy",
        tenant_id: tenantId,
        tenancy_id: tenancyId,
        property_id: propertyId,
        tenant_name: tenantName,
        tenant_email: tenantEmail,
        property_label: propertyLabel || null,
        start_date: startDate,
        monthly_rent: monthlyRent,
        created_tenant: createdTenant,
        created_tenancy: createdTenancy,
        reused_tenant: !createdTenant,
        reused_tenancy: !createdTenancy,
        ...onboarding,
      });
    }
    case "start_tenant_onboarding": {
      const tenancyId = args.tenancy_id?.trim();
      if (tenancyId) {
        const result = await runTenantOnboardingAgent(tenancyId, userId, supabase);
        return JSON.stringify({
          mode: "existing_tenancy",
          tenancy_id: tenancyId,
          ...result,
        });
      }

      let onboardingFor = args.onboarding_for?.trim() ?? "";
      if (
        !onboardingFor &&
        args.tenant_id?.trim() &&
        !looksLikeUuid(args.tenant_id.trim()) &&
        !args.property_id?.trim() &&
        !args.lead_id?.trim()
      ) {
        onboardingFor = args.tenant_id.trim();
      }
      if (onboardingFor) {
        const resolved = await resolveTenantProfileForAccount(supabase, userId, onboardingFor);
        if (!resolved.ok) {
          return JSON.stringify(resolved.body);
        }
        const { data: tenRows, error: tenErr } = await supabase
          .from("tenancies")
          .select(
            `
            id,
            status,
            property_id,
            properties!inner ( address, city, user_id )
          `,
          )
          .eq("tenant_id", resolved.tenantId)
          .eq("properties.user_id", userId);

        if (tenErr) {
          return JSON.stringify({ error: `Could not load tenancies: ${tenErr.message}` });
        }
        const rows = (tenRows ?? []) as TenancyRowForOnboarding[];
        if (rows.length === 0) {
          return JSON.stringify({
            code: "missing_tenancy_for_tenant",
            error: "No active tenancy found for this tenant yet.",
            message:
              "Ready to create tenancy. I still need the property and tenancy start date to continue.",
            blocked_by: ["property", "start_date"],
            what_i_have: {
              tenant_name: resolved.full_name,
              tenant_id: resolved.tenantId,
            },
            tenant_id: resolved.tenantId,
            full_name: resolved.full_name,
          });
        }

        const accountPropertyCount = await fetchAccountPropertyCount(supabase, userId);
        const picked = pickTenancyForOnboarding(rows, args.onboarding_property_hint, accountPropertyCount);
        if (picked.status === "ambiguous" || picked.status === "fall_through") {
          return JSON.stringify({
            code: picked.status === "ambiguous" ? "property_ambiguous" : "property_hint_not_matched",
            error:
              picked.status === "ambiguous"
                ? "More than one property matches this tenant."
                : "The property hint did not match a tenancy for this tenant.",
            message:
              picked.status === "ambiguous"
                ? "Ready to continue once you confirm the correct property."
                : "Ready to continue once you send a clearer property hint.",
            blocked_by: ["property_confirmation"],
            tenant_id: resolved.tenantId,
            full_name: resolved.full_name,
            tenant_resolved_via: resolved.resolved_via,
            candidates: picked.candidates,
          });
        }

        const result = await runTenantOnboardingAgent(picked.tenancy_id, userId, supabase);
        return JSON.stringify({
          mode: "onboarding_for_name",
          onboarded_for: resolved.full_name,
          tenant_id: resolved.tenantId,
          tenant_resolved_via: resolved.resolved_via,
          tenancy_id: picked.tenancy_id,
          ...result,
        });
      }

      const tenantIdNew = args.tenant_id?.trim();
      const propertyIdNew = args.property_id?.trim();
      const startDateNew = args.start_date?.trim();
      const leadIdArg = args.lead_id?.trim();

      if (tenantIdNew && propertyIdNew && startDateNew && !leadIdArg) {
        const resolvedTenant = await resolveTenantProfileForAccount(supabase, userId, tenantIdNew);
        if (!resolvedTenant.ok) {
          return JSON.stringify(resolvedTenant.body);
        }
        const tenantIdResolved = resolvedTenant.tenantId;

        const { data: propertyRow, error: propErr } = await supabase
          .from("properties")
          .select("id, user_id, monthly_rent")
          .eq("id", propertyIdNew)
          .eq("user_id", userId)
          .maybeSingle();
        if (propErr) {
          return JSON.stringify({ error: `Could not load property: ${propErr.message}` });
        }
        if (!propertyRow) {
          return JSON.stringify({
            code: "property_not_found",
            error: "I could not match that property on your account.",
            message: "Ready to continue once you confirm the property address or postcode.",
            blocked_by: ["property"],
          });
        }

        const { data: dup } = await supabase
          .from("tenancies")
          .select("id")
          .eq("tenant_id", tenantIdResolved)
          .eq("property_id", propertyIdNew)
          .eq("status", "active")
          .maybeSingle();
        if (dup) {
          return JSON.stringify({
            code: "tenancy_already_exists",
            error: "An active tenancy already exists for this tenant and property.",
            message: "Ready to continue onboarding on the existing tenancy.",
            next_action: "open_existing_tenancy_onboarding",
            tenancy_id: dup.id,
          });
        }

        const monthlyRent =
          propertyRow.monthly_rent == null ? null : Number(propertyRow.monthly_rent) || null;
        const endDate = addOneYearIsoDate(startDateNew);
        const newTenancyId = crypto.randomUUID();
        const { error: tenancyErr } = await supabase.from("tenancies").insert({
          id: newTenancyId,
          property_id: propertyIdNew,
          tenant_id: tenantIdResolved,
          start_date: startDateNew,
          end_date: endDate,
          monthly_rent: monthlyRent,
          deposit_amount: monthlyRent,
          status: "active",
        });
        if (tenancyErr) {
          return JSON.stringify({ error: `Could not create tenancy: ${tenancyErr.message}` });
        }

        const result = await runTenantOnboardingAgent(newTenancyId, userId, supabase);
        return JSON.stringify({
          mode: "tenant_and_property",
          tenant_id: tenantIdResolved,
          tenant_resolved_via: resolvedTenant.resolved_via,
          property_id: propertyIdNew,
          tenancy_id: newTenancyId,
          ...result,
        });
      }

      const leadId = args.lead_id?.trim();
      const createFromLead = parseBoolArg(args.auto_create_tenant_and_tenancy);
      if (!leadId || !createFromLead) {
        const missingFields: string[] = [];
        if (!tenantIdNew) missingFields.push("tenant");
        if (!propertyIdNew) missingFields.push("property");
        if (!startDateNew) missingFields.push("start_date");
        return JSON.stringify({
          code: "missing_create_fields",
          error: "Missing required fields to create tenant + tenancy in this step.",
          message:
            missingFields.length > 0
              ? `Ready to create once you provide: ${missingFields.join(", ")}.`
              : "Ready to create once you confirm whether this should be from a lead or direct tenant details.",
          blocked_by: missingFields,
          next_action:
            "Use create_tenant_and_tenancy for brand-new tenant creation from chat, or provide lead_id + auto_create_tenant_and_tenancy=true for lead conversion.",
          what_i_have: {
            tenant: tenantIdNew ?? null,
            property_id: propertyIdNew ?? null,
            start_date: startDateNew ?? null,
          },
        });
      }

      const { data: lead } = await supabase
        .from("leads")
        .select("id, user_id, property_id, full_name, name, email, phone, move_in_date, qualified_status, status")
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!lead) {
        return JSON.stringify({ error: "Lead not found for this account." });
      }

      const propertyId = (args.property_id?.trim() || lead.property_id || "") as string;
      if (!propertyId) {
        return JSON.stringify({
          code: "missing_property_for_lead_conversion",
          error: "Property is required before I can create tenancy from this lead.",
          message: "Ready to continue once you confirm the property for this lead.",
          blocked_by: ["property"],
        });
      }

      const { data: property } = await supabase
        .from("properties")
        .select("id, user_id, monthly_rent")
        .eq("id", propertyId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!property) {
        return JSON.stringify({
          code: "property_not_found",
          error: "I could not match that property on your account.",
          message: "Ready to continue once you confirm the property address or postcode.",
          blocked_by: ["property"],
        });
      }

      const tenantId = crypto.randomUUID();
      const tenantName = (lead.full_name ?? lead.name ?? "").trim();
      const { error: tenantErr } = await supabase.from("tenants").insert({
        id: tenantId,
        user_id: userId,
        full_name: tenantName || "New tenant",
        email: lead.email ?? null,
        phone: lead.phone ?? null,
      });
      if (tenantErr) {
        return JSON.stringify({ error: `Could not create tenant profile: ${tenantErr.message}` });
      }

      const newTenancyId = crypto.randomUUID();
      const startDate = (args.start_date ?? lead.move_in_date ?? new Date().toISOString().slice(0, 10)) as string;
      const monthlyRent =
        property.monthly_rent == null ? null : Number(property.monthly_rent) || null;
      const { error: tenancyErr } = await supabase.from("tenancies").insert({
        id: newTenancyId,
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: startDate,
        monthly_rent: monthlyRent,
        deposit_amount: monthlyRent,
        status: "active",
      });
      if (tenancyErr) {
        return JSON.stringify({ error: `Could not create tenancy: ${tenancyErr.message}` });
      }

      await supabase
        .from("leads")
        .update({
          qualified_status: "qualified",
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("user_id", userId);

      const result = await runTenantOnboardingAgent(newTenancyId, userId, supabase);
      return JSON.stringify({
        mode: "lead_conversion",
        lead_id: leadId,
        tenant_id: tenantId,
        tenancy_id: newTenancyId,
        ...result,
      });
    }
    case "bulk_onboard_tenants": {
      const csvText = args.csv_text?.trim();
      if (!csvText) {
        return JSON.stringify({
          error:
            "Paste a CSV in `csv_text`. Required columns: property_address, tenant_name, tenant_email, monthly_rent, start_date.",
        });
      }

      const { parseBatchOnboardingCsv, extractBatchOnboardingRowsWithLlmFromText } = await import(
        "@/lib/onboarding/tenant-import"
      );
      const { prepareBatchOnboarding, runBatchOnboarding } = await import(
        "@/lib/onboarding/batch-onboard"
      );

      let rows = parseBatchOnboardingCsv(csvText);
      if (rows.length === 0) {
        const llm = await extractBatchOnboardingRowsWithLlmFromText(csvText);
        if (!llm.ok) {
          return JSON.stringify({
            error:
              "Couldn't parse any rows. Expected header: property_address, tenant_name, tenant_email, monthly_rent, start_date.",
          });
        }
        rows = llm.rows;
      }

      const prepared = await prepareBatchOnboarding(rows, userId, supabase);
      const previewOnly = /^(1|true|yes)$/i.test(args.preview?.trim() ?? "");

      const previewRows = prepared.rows.slice(0, 10).map((r) => ({
        row: r.rowIndex + 1,
        property: r.raw.propertyAddress,
        tenant: r.raw.tenantFullName,
        email: r.raw.tenantEmail,
        monthly_rent: r.raw.monthlyRent,
        start_date: r.raw.startDate,
        status: r.tags.join("+"),
        errors: r.raw.rowErrors,
      }));

      if (previewOnly) {
        return JSON.stringify({
          mode: "preview",
          summary: prepared.summary,
          preview_rows: previewRows,
        });
      }

      if (prepared.summary.actionableRows === 0) {
        return JSON.stringify({
          mode: "nothing_to_do",
          summary: prepared.summary,
          preview_rows: previewRows,
          note:
            prepared.summary.validationErrors > 0
              ? "Every row has validation errors. Fix the CSV and try again."
              : "All rows are already onboarded — nothing new to create.",
        });
      }

      const runResult = await runBatchOnboarding(prepared, userId, supabase);

      return JSON.stringify({
        mode: "executed",
        batch_id: runResult.batchId,
        totals: runResult.totals,
        summary: prepared.summary,
        preview_rows: previewRows,
        outcomes_preview: runResult.outcomes.slice(0, 10).map((o) => ({
          row: o.rowIndex + 1,
          status: o.status,
          tenancy_id: o.tenancyId,
          email_status: o.emailStatus,
          error: o.error ?? null,
        })),
      });
    }
    case "send_referencing_handoff": {
      const resolved = await resolveTenancyIdForReferencingHandoff(supabase, userId, args);
      if (!resolved.ok) {
        return resolved.response;
      }

      const { data: refTenancyStatus } = await supabase
        .from("tenancies")
        .select("onboarding_status")
        .eq("id", resolved.tenancyId)
        .single();
      const refCurrentStatus = String(refTenancyStatus?.onboarding_status ?? "not_started");
      if (isStepAlreadyDone(refCurrentStatus, "referencing_requested")) {
        return JSON.stringify({
          success: false,
          already_done: true,
          message: `Referencing was already requested for this tenancy (status: ${refCurrentStatus}). Skipping.`,
          onboarding_status: refCurrentStatus,
        });
      }

      const refResult = await runReferencingHandoffForUser(resolved.tenancyId, userId, supabase, {
        forceSend: true,
      });
      if (!refResult.ok) {
        const errText = refResult.error;
        const missingAgency =
          /referencing agency email|set a referencing agency/i.test(errText) ||
          errText.includes("Settings (Referencing)");
        return JSON.stringify({
          error: errText,
          ...(missingAgency
            ? {
                code: "missing_agency_email" as const,
                redirect_path: "/dashboard/settings?tab=email",
              }
            : {}),
        });
      }

      const { data: labelRow } = await supabase
        .from("tenancies")
        .select(`tenants ( full_name ), properties!inner ( address, city )`)
        .eq("id", resolved.tenancyId)
        .maybeSingle();

      let tenantNameForUi: string | null = null;
      let propertyAddressForUi: string | null = null;
      if (labelRow) {
        const tp = labelRow.tenants as unknown as
          | { full_name: string | null }
          | { full_name: string | null }[]
          | null;
        const t = Array.isArray(tp) ? tp[0] : tp;
        tenantNameForUi = t?.full_name?.trim() || null;
        const pr = labelRow.properties as unknown as { address: string | null; city: string | null };
        propertyAddressForUi = [pr.address, pr.city].filter(Boolean).join(", ") || null;
      }

      return JSON.stringify({
        ok: true,
        sent: refResult.sent,
        message: refResult.message,
        tenant_name: tenantNameForUi,
        property_address: propertyAddressForUi,
        tenancy_id: resolved.tenancyId,
        email_log_id: refResult.emailLogId,
        ceo_force_send: true,
      });
    }
    case "prepare_referencing": {
      const resolvedPrep = await resolveTenancyIdForReferencingHandoff(supabase, userId, args);
      if (!resolvedPrep.ok) {
        return resolvedPrep.response;
      }
      const prepTenancyId = resolvedPrep.tenancyId;

      const { data: settings } = await supabase
        .from("user_settings")
        .select("referencing_agency_name, referencing_agency_email")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: tenancy, error: prepErr } = await supabase
        .from("tenancies")
        .select(
          `
          id,
          onboarding_status,
          referencing_agency_email_override,
          referencing_last_outbound_at,
          referencing_last_inbound_at,
          properties!inner ( user_id ),
          tenants ( full_name )
        `,
        )
        .eq("id", prepTenancyId)
        .maybeSingle();

      if (prepErr || !tenancy) {
        return JSON.stringify({ ok: false as const, error: "Tenancy not found." });
      }

      const prop = tenancy.properties as unknown as { user_id: string };
      if (prop.user_id !== userId) {
        return JSON.stringify({ ok: false as const, error: "Tenancy not found." });
      }

      const agencyEmail =
        (tenancy.referencing_agency_email_override as string | null)?.trim() ||
        (settings?.referencing_agency_email as string | null)?.trim() ||
        "";

      const tenancyRow = tenancy as {
        onboarding_status?: string;
        referencing_last_outbound_at?: string | null;
        referencing_last_inbound_at?: string | null;
      };
      const onboardingStatus = String(tenancyRow.onboarding_status ?? "not_started");
      const referencingComplete = onboardingStatus === "contract_sent" || onboardingStatus === "complete";
      const outboundAt = tenancyRow.referencing_last_outbound_at ?? null;
      const inboundAt = tenancyRow.referencing_last_inbound_at ?? null;
      const handoffSent = Boolean(outboundAt && String(outboundAt).trim().length > 0);

      const tenantRaw = tenancy.tenants as unknown as
        | { full_name: string | null }
        | { full_name: string | null }[]
        | null;
      const tenantRow = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
      const tenantName = tenantRow?.full_name?.trim() || undefined;

      const { data: taskRows } = await supabase
        .from("onboarding_tasks")
        .select("task_name, status")
        .eq("tenancy_id", prepTenancyId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      const tasks = (taskRows ?? []).map((t) => ({
        task_name: String(t.task_name ?? ""),
        status: String(t.status ?? ""),
      }));
      const tasksTotal = tasks.length;
      const tasksComplete = tasks.filter((t) => t.status === "complete").length;

      if (!agencyEmail) {
        return JSON.stringify({
          ok: false as const,
          code: "missing_agency_email" as const,
          redirect_path: "/dashboard/settings?tab=email",
          message:
            "Add a default referencing agency email under Settings → Email & Automation, or set an override on this tenancy.",
        });
      }

      const agencyName = (settings?.referencing_agency_name as string | null)?.trim() || "your referencing agency";

      const { data: inboundMailRows } = await supabase
        .from("referencing_events")
        .select("created_at, subject, body_preview, outcome")
        .eq("user_id", userId)
        .eq("tenancy_id", prepTenancyId)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(8);

      const recent_inbound_mail = (inboundMailRows ?? []).map((r) => ({
        created_at: r.created_at ?? null,
        subject: r.subject ?? null,
        body_preview: r.body_preview ? String(r.body_preview).slice(0, 400) : null,
        outcome: r.outcome ?? null,
      }));

      const inboundRowCount = recent_inbound_mail.length;
      const latestPreview = recent_inbound_mail[0]?.body_preview ?? null;
      const ceo_instruction =
        inboundRowCount > 0
          ? `Letora has ${inboundRowCount} inbound mail row(s) for this tenancy. Latest preview: ${String(latestPreview ?? "").slice(0, 220)}. Your reply MUST acknowledge this recorded activity — do not say the agency has not responded or that there is no inbound mail.`
          : "No inbound referencing_events rows for this tenancy in Letora yet — if the user expects an agency email, say we have no logged inbound text for this case (webhook may have been ignored or no LETORA_REF in the reply).";

      return JSON.stringify({
        ok: true as const,
        tenancy_id: prepTenancyId,
        agency_email: agencyEmail,
        agency_name: agencyName,
        tenant_name: tenantName,
        onboarding_status: onboardingStatus,
        referencing_complete: referencingComplete,
        referencing_last_outbound_at: outboundAt,
        referencing_last_inbound_at: inboundAt,
        handoff_sent: handoffSent,
        recent_inbound_mail,
        ceo_instruction,
        tasks,
        tasks_complete: tasksComplete,
        tasks_total: tasksTotal,
      });
    }
    case "dispatch_maintenance_request": {
      const tenancyId = args.tenancy_id?.trim();
      const issue = (args.issue_description ?? "").trim();
      if (!tenancyId || !issue) {
        return JSON.stringify({
          error: "tenancy_id and issue_description are required.",
        });
      }

      const { data: tenancy } = await supabase
        .from("tenancies")
        .select(
          "id, property_id, properties!inner(user_id, address), tenants!inner(id, full_name, email)",
        )
        .eq("id", tenancyId)
        .eq("properties.user_id", userId)
        .maybeSingle();
      if (!tenancy) {
        return JSON.stringify({ error: "Tenancy not found for this account." });
      }

      const classified = classifyMaintenanceCategory(
        `${args.issue_title ?? ""} ${args.issue_description ?? ""}`,
      );
      const requestId = crypto.randomUUID();
      const fullDescription = [args.issue_title?.trim(), args.issue_description?.trim()]
        .filter(Boolean)
        .join("\n\n");
      const { error: insertErr } = await supabase.from("maintenance_requests").insert({
        id: requestId,
        tenancy_id: tenancyId,
        description: fullDescription,
        category: classified.category,
        priority: classified.priority,
        status: "open",
        reported_by_tenant: false,
      });
      if (insertErr) {
        return JSON.stringify({ error: `Failed to create maintenance request: ${insertErr.message}` });
      }

      const triage = await runMaintenanceAgent(requestId, userId, supabase);
      const contractorEmail = args.contractor_email?.trim();
      const contractorName = args.contractor_name?.trim() || "Contractor";
      const requestedChannel = args.dispatch_channel ?? "email";
      let contractorDispatch:
        | {
            sent: boolean;
            emailLogId: string;
            message: string;
            error?: string;
            pending_approval?: boolean;
          }
        | null = null;

      const propRaw = tenancy.properties as { user_id: string; address: string | null } | { user_id: string; address: string | null }[];
      const propertyRow = Array.isArray(propRaw) ? propRaw[0] : propRaw;
      const tenantRaw = tenancy.tenants as { id: string; full_name: string | null; email: string | null } | { id: string; full_name: string | null; email: string | null }[];
      const tenantRow = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
      const propertyAddress =
        normalizePropertyAddressLabel(propertyRow?.address?.trim() ?? "") || "Unknown property";
      const tenantNameForEvidence = tenantRow?.full_name?.trim() ?? null;

      const dispatchEmailSubject = `Maintenance dispatch: ${args.issue_title?.trim() || "New issue"}`;
      const dispatchEmailBody = [
        `A maintenance request has been raised.`,
        `Category: ${classified.category}`,
        `Priority: ${classified.priority}`,
        "",
        `Issue details:`,
        fullDescription,
      ].join("\n");

      if (requestedChannel !== "sms" && contractorEmail) {
        const evidence: ApproveMaintenanceDispatchEvidence = {
          maintenanceRequestId: requestId,
          propertyId: (tenancy.property_id as string | null) ?? null,
          propertyAddress,
          tenantName: tenantNameForEvidence,
          category: classified.category,
          priority: classified.priority,
          contractorName,
          contractorEmail,
          emailSubject: dispatchEmailSubject,
          dispatchPreview:
            dispatchEmailBody.length > 400 ? `${dispatchEmailBody.slice(0, 397)}…` : dispatchEmailBody,
        };

        const approval = await createAgentApproval(
          {
            agentRunId: triage.agentRunId,
            agentType: "maintenance_dispatch",
            title: `Approve contractor dispatch — ${args.issue_title?.trim() || "Maintenance"}`,
            summary: `${propertyAddress} · ${contractorName} · ${classified.priority}`,
            actionType: "approve_maintenance_dispatch",
            targetType: "maintenance_request",
            targetId: requestId,
            payload: {
              userId,
              maintenanceRequestId: requestId,
              tenancyId,
              propertyId: (tenancy.property_id as string | null) ?? null,
              contractorEmail,
              contractorName,
              emailSubject: dispatchEmailSubject,
              emailBody: dispatchEmailBody,
              category: classified.category,
              priority: classified.priority,
            },
            evidence,
          } satisfies CreateAgentApprovalContract,
          { supabase, userId },
        );

        if (!approval.ok) {
          return JSON.stringify({
            error: approval.error,
            maintenance_request_id: requestId,
            category: classified.category,
            priority: classified.priority,
            triage,
          });
        }

        contractorDispatch = {
          sent: false,
          emailLogId: "",
          message: "Contractor dispatch is pending your approval in Approvals.",
          pending_approval: true,
        };
      }

      return JSON.stringify({
        maintenance_request_id: requestId,
        category: classified.category,
        priority: classified.priority,
        triage,
        contractor_dispatch: contractorDispatch,
        channel_note:
          requestedChannel === "sms"
            ? "SMS dispatch requested but SMS transport is not yet implemented in-app; no SMS sent."
            : requestedChannel === "both"
              ? "Email dispatch pending approval (SMS not yet implemented)."
              : contractorEmail
                ? "Contractor email will send after you approve the dispatch in Approvals."
                : "No contractor email provided — log the issue only; assign a contractor from the maintenance screen if needed.",
      });
    }
    case "generate_property_listing": {
      const propertyId = args.property_id?.trim();
      if (!propertyId) {
        return JSON.stringify({ error: "property_id is required." });
      }
      const { data: property } = await supabase
        .from("properties")
        .select("id, user_id, address, city, postcode, property_type, bedrooms, bathrooms, monthly_rent, status")
        .eq("id", propertyId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!property) {
        return JSON.stringify({ error: "Property not found for this account." });
      }

      const tone = args.tone ?? "premium";
      const channel = args.target_channel ?? "generic";
      const save = args.save_to_property !== false;
      const listingResp = await runLLM({
        agentName: "ceo",
        messages: [
          {
            role: "system",
            content:
              "You are a UK property marketing copywriter. Write concise, factual, compliant listing copy. Do not invent features.",
          },
          {
            role: "user",
            content: `Generate ${channel} listing copy in a ${tone} tone for this property JSON: ${JSON.stringify(
              property,
            )}. Return plain text only.`,
          },
        ],
        maxTokens: 700,
      });
      const listing = listingResp.text.trim();
      if (!save) {
        return JSON.stringify({
          property_id: propertyId,
          saved: false,
          listing_description: listing,
        });
      }

      const { error: saveErr } = await supabase
        .from("properties")
        .update({ marketing_description: listing })
        .eq("id", propertyId)
        .eq("user_id", userId);

      return JSON.stringify({
        property_id: propertyId,
        saved: !saveErr,
        save_error: saveErr?.message ?? null,
        listing_description: listing,
      });
    }
    case "qualify_leads": {
      /**
       * Delegates to `runLeadQualifierAgent(userId)` — the specialist uses its own DB client and rules.
       * Optional `lead_id` in tool input (not required by schema) scopes pre-checks to one lead.
       */
      const optionalLeadId = args.lead_id?.trim();

      const notEligible = (reason: string, extra: Record<string, unknown>) =>
        JSON.stringify({
          parse_ok: false,
          persisted: [] as { id: string; qualified_status: string; score?: number }[],
          error: "qualification_skipped",
          reason,
          details: extra,
        });

      if (optionalLeadId) {
        const { data: lead, error: leadErr } = await supabase
          .from("leads")
          .select("id, status, qualified_status")
          .eq("id", optionalLeadId)
          .eq("user_id", userId)
          .maybeSingle();

        if (leadErr) {
          return JSON.stringify({
            parse_ok: false,
            persisted: [],
            error: "database_error",
            details: { message: leadErr.message },
          });
        }
        if (!lead) {
          return notEligible("lead_not_found", { lead_id: optionalLeadId });
        }

        const pipeline = normalizePipelineStatus(lead.status);
        const qs = normalizePipelineStatus(lead.qualified_status);

        if (qs !== "pending") {
          return notEligible("qualified_status_not_pending", {
            lead_id: optionalLeadId,
            qualified_status: lead.qualified_status ?? null,
          });
        }
        if (pipeline !== "new") {
          return notEligible("pipeline_status_not_new", {
            lead_id: optionalLeadId,
            status: lead.status ?? null,
          });
        }
      } else {
        const { data: anyEligible, error: eligErr } = await supabase
          .from("leads")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "new")
          .eq("qualified_status", "pending")
          .limit(1);

        if (eligErr) {
          return JSON.stringify({
            parse_ok: false,
            persisted: [],
            error: "database_error",
            details: { message: eligErr.message },
          });
        }
        if (!anyEligible?.length) {
          return JSON.stringify({
            parse_ok: true,
            persisted: [],
            details: {
              message:
                "No eligible leads: the specialist requires pipeline status new and qualification pending.",
            },
          });
        }
      }

      let results: Awaited<ReturnType<typeof runLeadQualifierAgent>>;
      try {
        /** Session-scoped client — same as rent chaser / API route so RLS updates succeed. */
        results = await runLeadQualifierAgent(userId, { supabase });
      } catch (e) {
        return JSON.stringify({
          parse_ok: false,
          persisted: [],
          error: "lead_qualifier_agent_failed",
          details: { message: e instanceof Error ? e.message : String(e) },
        });
      }

      const persistedAll = results.map((r) => ({
        id: r.leadId,
        qualified_status: r.recommendation === "qualify" ? "qualified" : "disqualified",
        score: r.score,
      }));

      if (optionalLeadId) {
        const hit = results.find((r) => r.leadId === optionalLeadId);
        if (!hit) {
          return JSON.stringify({
            parse_ok: false,
            persisted: persistedAll,
            error: "target_lead_not_in_result",
            reason:
              "The specialist ran but did not return this lead (e.g. skipped during processing). Check /dashboard/leads.",
            details: {
              lead_id: optionalLeadId,
              processed_count: results.length,
              processed_lead_ids: results.map((r) => r.leadId),
            },
          });
        }
        return JSON.stringify({
          parse_ok: true,
          persisted: [
            {
              id: hit.leadId,
              qualified_status: hit.recommendation === "qualify" ? "qualified" : "disqualified",
              score: hit.score,
            },
          ],
          details: {
            fullName: hit.fullName,
            score: hit.score,
            recommendation: hit.recommendation,
            reasoning: hit.reasoning,
            actionId: hit.actionId,
          },
        });
      }

      return JSON.stringify({
        parse_ok: results.length > 0,
        persisted: persistedAll,
        details: {
          total_processed: results.length,
          results: results.map((r) => ({
            leadId: r.leadId,
            fullName: r.fullName,
            score: r.score,
            recommendation: r.recommendation,
            reasoning: r.reasoning,
          })),
        },
      });
    }
    case "nurture_lead": {
      const leadId = args.lead_id?.trim();
      const rawStep = (args.step ?? "").trim();
      const step =
        rawStep === "initial_contact" || rawStep === "viewing" || rawStep === "application"
          ? rawStep
          : null;
      if (!leadId || !step) {
        return JSON.stringify({ error: "lead_id and step (initial_contact | viewing | application) are required." });
      }

      const { data: lead } = await supabase
        .from("leads")
        .select(
          "id, user_id, property_id, full_name, name, email, phone, budget, move_in_date, qualified_status, status, notes",
        )
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!lead) {
        return JSON.stringify({ error: "Lead not found for this account." });
      }

      const qualified = normalizePipelineStatus(lead.qualified_status);
      if (qualified !== "qualified") {
        return JSON.stringify({
          error: "This lead must be qualified before nurture. Run qualify_leads or use the Leads dashboard first.",
          qualified_status: lead.qualified_status ?? null,
        });
      }

      const toEmail = (lead.email ?? "").trim();
      if (!toEmail) {
        return JSON.stringify({ error: "Lead has no email address; add one on the lead record before nurturing." });
      }

      let propertyAddress = "the property";
      if (lead.property_id) {
        const { data: prop } = await supabase
          .from("properties")
          .select("address, city, postcode")
          .eq("id", lead.property_id as string)
          .eq("user_id", userId)
          .maybeSingle();
        if (prop) {
          const parts = [prop.address, prop.city, prop.postcode].filter(Boolean).join(", ");
          if (parts.trim()) propertyAddress = parts.trim();
        }
      }

      const current = normalizePipelineStatus(lead.status);
      type NurtureStep = "initial_contact" | "viewing" | "application";
      const expected: Record<NurtureStep, { from: string; to: string }> = {
        initial_contact: { from: "new", to: "contacted" },
        viewing: { from: "contacted", to: "viewing" },
        application: { from: "viewing", to: "applied" },
      };

      const transition = expected[step];
      if (current !== transition.from) {
        return JSON.stringify({
          error: `Wrong pipeline stage for this step. Current status is "${current}"; expected "${transition.from}" for ${step}.`,
          current_status: current,
          expected_status: transition.from,
        });
      }

      const leadName = displayLeadName(lead);
      const stepLabel =
        step === "initial_contact"
          ? "initial contact after their enquiry"
          : step === "viewing"
            ? "scheduling or confirming a viewing"
            : "inviting them to complete the tenancy application";

      const subject =
        step === "initial_contact"
          ? "Re: your property enquiry"
          : step === "viewing"
            ? "Viewing arrangement"
            : "Tenancy application — next steps";

      const draft = await runLLM({
        agentName: "ceo",
        messages: [
          {
            role: "system",
            content:
              "You write concise, professional UK landlord emails to prospective tenants. Output plain text only (no subject line). 3–4 short paragraphs max. Warm but businesslike.",
          },
          {
            role: "user",
            content: `Draft an email to ${leadName} (${toEmail}) about ${propertyAddress}, for ${stepLabel}. Context: budget ${lead.budget ?? "n/a"}, move-in preference ${lead.move_in_date ?? "n/a"}.`,
          },
        ],
        maxTokens: 600,
      });

      const body = draft.text.trim();
      void saveEmailDraft(supabase, userId, { subject, body });
      const emailResult = await sendEmailTool(supabase, userId, null, {
        to: toEmail,
        toName: leadName,
        subject,
        body,
        agentType: "lead",
      });

      const noteLine = `Nurture (${step}): email ${emailResult.sent ? "sent" : "saved as draft"} — ${emailResult.message}`;
      const note = appendLeadNote(lead.notes as string | null, noteLine);

      const { error: upErr } = await supabase
        .from("leads")
        .update({
          status: transition.to,
          notes: note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("user_id", userId);

      if (upErr) {
        return JSON.stringify({
          error: `Email prepared but could not update lead: ${upErr.message}`,
          email_sent: emailResult.sent,
          email_log_id: emailResult.emailLogId,
        });
      }

      return JSON.stringify({
        lead_id: leadId,
        step,
        previous_status: transition.from,
        new_status: transition.to,
        email_draft_or_sent: emailResult.sent ? "sent" : "draft",
        email_log_id: emailResult.emailLogId,
        email_message: emailResult.message,
      });
    }
    case "decide_lead_application": {
      const leadId = args.lead_id?.trim();
      const rawDecision = (args.decision ?? "").trim().toLowerCase();
      const decision = rawDecision === "approved" || rawDecision === "rejected" ? rawDecision : null;
      if (!leadId || !decision) {
        return JSON.stringify({ error: "lead_id and decision (approved | rejected) are required." });
      }

      const { data: lead } = await supabase
        .from("leads")
        .select("id, status, notes")
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!lead) {
        return JSON.stringify({ error: "Lead not found for this account." });
      }

      const current = normalizePipelineStatus(lead.status);
      if (current !== "applied") {
        return JSON.stringify({
          error: `Landlord decision applies only to leads in the applied stage. Current status: "${current}".`,
          current_status: current,
        });
      }

      const newStatus = decision === "approved" ? "approved" : "rejected";
      const note = appendLeadNote(lead.notes as string | null, `Landlord decision: ${decision}`);

      const { error: upErr } = await supabase
        .from("leads")
        .update({
          status: newStatus,
          notes: note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("user_id", userId);

      if (upErr) {
        return JSON.stringify({ error: upErr.message });
      }

      return JSON.stringify({
        lead_id: leadId,
        decision,
        new_status: newStatus,
      });
    }
    case "draft_contract": {
      try {
      console.log("[draft_contract] args:", JSON.stringify(args));
      const overrideContract = parseBoolArg(args.override);
      const tenancyIdArg = args.tenancy_id?.trim();
      const propertyHint = args.onboarding_property_hint?.trim();
      console.log("[draft_contract] property hint:", propertyHint);
      const accountPropertyCount = await fetchAccountPropertyCount(supabase, userId);

      type TenantRow = {
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
      };

      type TenancyDataShape = {
        start_date: string | null;
        end_date: string | null;
        monthly_rent: number | string | null;
        deposit_amount: number | string | null;
        property_id: string;
        onboarding_status: string | null;
      };

      let tenantRow: TenantRow | undefined;
      let resolvedTenancyId: string | undefined;
      let tenancyData: TenancyDataShape | undefined;
      let propertyLabel: string | undefined;

      if (tenancyIdArg) {
        const { data: tenancyRow, error: tenancyErr } = await supabase
          .from("tenancies")
          .select("id, tenant_id, property_id, start_date, end_date, monthly_rent, deposit_amount, onboarding_status, move_in_date, status")
          .eq("id", tenancyIdArg)
          .single();

        console.log("[draft_contract] tenancy lookup result:", JSON.stringify(tenancyRow));

        if (tenancyErr || !tenancyRow) {
          return JSON.stringify({
            error: "Tenancy not found for this account.",
            code: "not_found",
          });
        }

        const tenancyPropertyId = tenancyRow.property_id as string | null;
        if (!tenancyPropertyId) {
          return JSON.stringify({
            error: "This tenancy has no property linked.",
            code: "invalid_tenancy",
          });
        }

        const { data: propRow, error: propErr } = await supabase
          .from("properties")
          .select("id, address, postcode, city, property_type, bedrooms, bathrooms")
          .eq("id", tenancyPropertyId)
          .single();

        console.log("[draft_contract] property:", JSON.stringify({ data: propRow, error: propErr }));

        if (propErr || !propRow) {
          return JSON.stringify({
            success: false,
            message: `Property not found for this tenancy (property_id: ${tenancyPropertyId})`,
            code: "not_found",
          });
        }

        const tenancyTenantId = tenancyRow.tenant_id as string | null;
        if (!tenancyTenantId) {
          return JSON.stringify({
            error: "This tenancy has no tenant profile linked.",
            code: "invalid_tenancy",
          });
        }

        const { data: tenantProfile, error: tpErr } = await supabase
          .from("tenants")
          .select("id, full_name, email, phone")
          .eq("id", tenancyTenantId)
          .single();

        console.log("[draft_contract] tenant lookup result:", JSON.stringify(tenantProfile));

        if (tpErr || !tenantProfile) {
          return JSON.stringify({
            error: "This tenancy has no tenant profile linked.",
            code: "invalid_tenancy",
          });
        }

        tenantRow = tenantProfile as TenantRow;
        resolvedTenancyId = String(tenancyRow.id);
        tenancyData = {
          start_date: tenancyRow.start_date as string | null,
          end_date: tenancyRow.end_date as string | null,
          monthly_rent: tenancyRow.monthly_rent as number | string | null,
          deposit_amount: tenancyRow.deposit_amount as number | string | null,
          property_id: String(tenancyPropertyId),
          onboarding_status: tenancyRow.onboarding_status as string | null,
        };
        propertyLabel = [
          propRow.address as string | null,
          propRow.city as string | null,
          propRow.postcode as string | null,
        ].filter(Boolean).join(", ") || "Property";
      } else {
        const tid = args.tenant_id?.trim();
        const tname = args.tenant_name?.trim() ? sanitizeTenantName(args.tenant_name.trim()) : undefined;
        console.log("[draft_contract] tenant query:", tname ?? tid ?? "(none)");

        let loadedFromProperty = false;

        if (!tid && !tname && propertyHint) {
          console.log("[draft_contract] resolving by property hint only (no tenant id/name)");
          const pr = await resolveDraftContractByPropertyHint(supabase, userId, propertyHint, null);
          console.log("[draft_contract] property-hint resolve ok:", pr.ok);
          if (!pr.ok) return pr.json;
          tenantRow = pr.data.tenantRow;
          resolvedTenancyId = pr.data.resolvedTenancyId;
          tenancyData = pr.data.tenancyData;
          propertyLabel = pr.data.propertyLabel;
          loadedFromProperty = true;
        } else if (!tid && !tname) {
          return JSON.stringify({
            error:
              "Pass tenant_name, tenant_id (UUID from list_tenants), tenancy_id, or onboarding_property_hint (street or city).",
            code: "missing_tenant",
          });
        }

        if (!loadedFromProperty) {
          const raw = tid ?? tname ?? "";
          console.log("[draft_contract] resolveTenantProfileForAccount query:", raw);
          const resolved = await resolveTenantProfileForAccount(supabase, userId, raw);
          console.log("[draft_contract] tenant result:", JSON.stringify(resolved.ok ? { ok: true, tenantId: resolved.tenantId } : { ok: false, body: resolved.body }));
          if (!resolved.ok) {
            if (propertyHint) {
              const pr = await resolveDraftContractByPropertyHint(supabase, userId, propertyHint, tname ?? null);
              if (!pr.ok) return pr.json;
              tenantRow = pr.data.tenantRow;
              resolvedTenancyId = pr.data.resolvedTenancyId;
              tenancyData = pr.data.tenancyData;
              propertyLabel = pr.data.propertyLabel;
              loadedFromProperty = true;
            } else {
              return JSON.stringify({
                ...resolved.body,
                code: Array.isArray(resolved.body.candidates) ? "multiple_tenants" : "tenant_not_found",
              });
            }
          }

          if (!loadedFromProperty && resolved.ok) {
            const { data: tp } = await supabase
              .from("tenants")
              .select("id, full_name, email, phone")
              .eq("id", resolved.tenantId)
              .maybeSingle();

            if (!tp) {
              return JSON.stringify({
                error: "Could not load tenant profile after resolve.",
                code: "tenant_not_found",
              });
            }
            tenantRow = tp as TenantRow;

            const { data: tenRows } = await supabase
              .from("tenancies")
              .select(
                `id, status, start_date, end_date, monthly_rent, deposit_amount, property_id, onboarding_status, tenants!inner ( user_id ), properties ( address, city )`,
              )
              .eq("tenant_id", resolved.tenantId)
              .eq("tenants.user_id", userId);

            const owned = await enrichTenancyRowsWithPropertyDetails(
              supabase,
              (tenRows ?? []) as TenancyRowForOnboarding[],
            );

            if (owned.length === 0) {
              /**
               * Dashboard “New contract” only needs tenant + property — no `tenancies` row.
               * If the tenant has no linked tenancy but the address matches a property, draft like the dashboard.
               */
              if (propertyHint?.trim()) {
                const { data: propRows, error: propFetchErr2 } = await supabase
                  .from("properties")
                  .select("id, address, city, monthly_rent")
                  .eq("user_id", userId);
                console.log(
                  "[property lookup] hint:",
                  propertyHint.trim(),
                  "userId:",
                  userId,
                  "results:",
                  propRows?.length,
                  "error:",
                  propFetchErr2?.message,
                );
                const mapped: PropertyRowForMatch[] = (propRows ?? []).map((r) => ({
                  id: String((r as { id: string }).id),
                  address: (r as { address?: string | null }).address ?? null,
                  city: (r as { city?: string | null }).city ?? null,
                }));
                const pr = resolvePropertyRowsForDraftHint(mapped, propertyHint.trim(), accountPropertyCount);
                if (pr.kind === "matched_by_fallback") {
                  return JSON.stringify({
                    code: "matched_by_fallback",
                    message: `I found one property — ${[pr.row.address, pr.row.city].filter(Boolean).join(", ") || "your property"}. Is this the right one?`,
                    property: {
                      property_id: pr.row.id,
                      address: pr.row.address,
                      city: pr.row.city,
                    },
                    matched_by_fallback: true,
                  });
                }
                if (pr.kind === "ambiguous_match") {
                  return JSON.stringify({
                    code: "ambiguous_match",
                    message: "I found a few possible properties — which one did you mean?",
                    candidates: pr.candidates.map((p) => ({
                      property_id: p.id,
                      address: p.address,
                      city: p.city,
                    })),
                  });
                }
                if (pr.kind === "no_property_match") {
                  return JSON.stringify({
                    code: "no_property_match",
                    message:
                      "I couldn't find a matching property. Can you confirm the exact address or check your Properties section?",
                    reason: pr.reason,
                  });
                }
                const prop = propRows?.find((r) => String((r as { id: string }).id) === pr.row.id) as
                  | {
                      id: string;
                      address: string | null;
                      city: string | null;
                      monthly_rent: number | string | null;
                    }
                  | undefined;
                if (!prop) {
                  return JSON.stringify({
                    code: "internal",
                    error: "Matched property row could not be reloaded.",
                  });
                }
                const mr = Number(prop.monthly_rent ?? 0) || 0;
                tenancyData = {
                  start_date: null,
                  end_date: null,
                  monthly_rent: prop.monthly_rent,
                  deposit_amount: mr > 0 ? mr : null,
                  property_id: String(prop.id),
                  onboarding_status: "contract_sent",
                };
                propertyLabel = [prop.address, prop.city].filter(Boolean).join(", ") || "Property";
                resolvedTenancyId = undefined;
              } else {
                return JSON.stringify({
                  error:
                    "No tenancy with a property on your account for this tenant. Add onboarding_property_hint (street) if the tenant should match a specific property, or link a tenancy first.",
                  code: "no_tenancy",
                });
              }
            }

            if (owned.length > 0) {
            const pool = owned.map((r) => ({
              id: r.id as string,
              status: r.status as string | null | undefined,
              properties: r.properties,
            })) as TenancyRowForOnboarding[];

            const picked = pickTenancyForOnboarding(pool, propertyHint, accountPropertyCount);
            if (picked.status === "fallback_confirm") {
              return JSON.stringify({
                code: "matched_by_fallback",
                message: `I found one property — ${picked.property_label}. Is this the right one?`,
                tenancy_id: picked.tenancy_id,
                matched_by_fallback: true,
              });
            }
            if (picked.status === "ambiguous") {
              return JSON.stringify({
                code: "ambiguous_match",
                message: "I found a few possible properties — which one did you mean?",
                candidates: picked.candidates,
              });
            }
            if (picked.status === "fall_through") {
              return JSON.stringify({
                error:
                  "No tenancy matched that hint on your account. Try a clearer street or postcode, or use list_tenants.",
                code: "ambiguous_tenancy",
                candidates: picked.candidates,
              });
            }

            const chosen = owned.find((r) => String(r.id) === picked.tenancy_id);
            if (!chosen) {
              return JSON.stringify({ error: "Could not load the chosen tenancy.", code: "internal" });
            }

            const chosenPropertyId = chosen.property_id as string | null | undefined;
            if (!chosenPropertyId) {
              return JSON.stringify({
                error: "This tenancy has no property linked.",
                code: "invalid_tenancy",
              });
            }
            const { data: chosenPropRow, error: chosenPropErr } = await supabase
              .from("properties")
              .select("id, address, postcode, city, property_type, bedrooms, bathrooms")
              .eq("id", chosenPropertyId)
              .single();
            console.log("[draft_contract] property:", JSON.stringify({ data: chosenPropRow, error: chosenPropErr }));
            if (!chosenPropRow) {
              return JSON.stringify({
                success: false,
                message: `Property not found for this tenancy (property_id: ${chosenPropertyId})`,
                code: "not_found",
              });
            }
            propertyLabel =
              [chosenPropRow.address, chosenPropRow.city, chosenPropRow.postcode].filter(Boolean).join(", ") ||
              "Property";
            resolvedTenancyId = String(chosen.id);
            tenancyData = {
              start_date: chosen.start_date as string | null,
              end_date: chosen.end_date as string | null,
              monthly_rent: chosen.monthly_rent as number | string | null,
              deposit_amount: chosen.deposit_amount as number | string | null,
              property_id: String(chosen.property_id),
              onboarding_status: chosen.onboarding_status as string | null,
            };
            }
          }
        }
      }

      if (!tenantRow || !tenancyData || !propertyLabel) {
        return JSON.stringify({
          error:
            "Could not resolve tenant or tenancy for this contract. Try list_tenants, pass tenancy_id, or give tenant name and/or a property hint (street or city).",
          code: "resolve_failed",
        });
      }

      const onboardingStatus = String(tenancyData.onboarding_status ?? "not_started");
      const blockedStatuses = ["not_started", "in_progress", "references"];
      if (blockedStatuses.includes(onboardingStatus) && !overrideContract) {
        return JSON.stringify({
          error:
            "Referencing must be completed before drafting a tenancy contract. Finish referencing (or mark it complete on the tenancy) first. If you still want a draft, ask explicitly to **force** or **override** referencing.",
          code: "referencing_incomplete",
          onboarding_status: onboardingStatus,
        });
      }

      if (isStepAlreadyDone(onboardingStatus, "contract_sent") && !overrideContract) {
        return JSON.stringify({
          success: false,
          already_done: true,
          message: `A contract has already been drafted and sent for this tenancy (status: ${onboardingStatus}). If you want a new draft, ask to **override** or **force** it.`,
          onboarding_status: onboardingStatus,
        });
      }

      const tenantPayload = {
        tenant: tenantRow,
        tenancy_id: resolvedTenancyId && resolvedTenancyId.length > 0 ? resolvedTenancyId : null,
        property: propertyLabel,
        onboarding_status: onboardingStatus,
      };

      let result: { text: string };
      try {
        result = await runLLM({
          agentName: "contracts",
          messages: [
            {
              role: "system",
              content:
                "You are a tenancy contract drafting assistant. Draft a professional UK Assured Shorthold Tenancy (AST) contract using the provided tenant and property details.",
            },
            {
              role: "user",
              content: `Draft a tenancy contract for: ${JSON.stringify(tenantPayload)}`,
            },
          ],
          maxTokens: 2048,
        });
      } catch (e) {
        console.error("[draft_contract] runLLM failed", e);
        const msg = e instanceof Error ? e.message : String(e);
        return JSON.stringify({
          error:
            msg ||
            "Contract text could not be generated. If this persists, check ANTHROPIC_API_KEY and the contracts agent LLM config.",
          code: "llm_error",
          tenant_name: formatTenantNameFromProfile(tenantRow),
        });
      }

      const today = new Date();
      const defaultStart = tenancyData.start_date ?? today.toISOString().slice(0, 10);
      const defaultEnd =
        tenancyData.end_date ??
        new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
      const monthlyRent = Number(tenancyData.monthly_rent ?? 0) || 0;
      const depositAmount = Number(tenancyData.deposit_amount ?? monthlyRent) || 0;

      const { data: inserted, error: insErr } = await supabase
        .from("contracts")
        .insert({
          user_id: userId,
          tenant_id: tenantRow.id,
          property_id: tenancyData.property_id,
          tenancy_id: resolvedTenancyId || null,
          contract_type: "AST",
          start_date: defaultStart,
          end_date: defaultEnd,
          monthly_rent: monthlyRent,
          deposit_amount: depositAmount,
          special_clauses: result.text.trim() ? result.text.trim() : null,
          status: "draft",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insErr || !inserted) {
        const failResult = JSON.stringify({
          tenant_name: formatTenantNameFromProfile(tenantRow),
          contract_draft: result.text,
          saved: false,
          error: insErr?.message ?? "Could not save draft contract",
          code: "save_failed",
        });
        console.log("[draft_contract] returning:", failResult);
        return failResult;
      }

      const contractId = inserted.id as string;
      const tenantName = formatTenantNameFromProfile(tenantRow);
      const successResult = JSON.stringify({
        success: true,
        message: `Contract successfully drafted and saved. Contract ID: ${contractId}. The contract is now in drafts and ready for review.`,
        contract_id: contractId,
        tenant_name: tenantName,
        property_address: propertyLabel,
        contract_draft: result.text,
        saved: true,
        ...(resolvedTenancyId && resolvedTenancyId.length > 0 ? { tenancy_id: resolvedTenancyId } : {}),
      });
      console.log("[draft_contract] returning:", successResult);
      void logAgentActivity(supabase, userId, "draft_contract", args as Record<string, unknown>, { contract_id: contractId, saved: true }, true);
      return successResult;
      } catch (err: unknown) {
        console.error("[draft_contract] exception:", err);
        void logAgentActivity(supabase, userId, "draft_contract", args as Record<string, unknown>, { error: String(err) }, false);
        return JSON.stringify({
          saved: false,
          error: err instanceof Error ? err.message : String(err),
          code: "internal_error",
        });
      }
    }
    case "send_contract": {
      try {
        let contractId = args.contract_id?.trim();

        if (!contractId) {
          let tenancyId = args.tenancy_id?.trim();

          if (!tenancyId && args.tenant_name?.trim()) {
            const nameFragment = sanitizeIlikeNameFragment(sanitizeTenantName(args.tenant_name.trim()));
            const { data: tenantHits } = await supabase
              .from("tenants")
              .select("id, tenancies(id)")
              .ilike("full_name", `%${nameFragment}%`)
              .eq("user_id", userId)
              .limit(1);

            const firstHit = tenantHits?.[0];
            if (firstHit) {
              const tenancyRows = normalizeTenancyRows(firstHit.tenancies);
              if (tenancyRows.length === 1 && tenancyRows[0].id) {
                tenancyId = String(tenancyRows[0].id);
              }
            }
          }

          if (tenancyId) {
            const { data: latestContract } = await supabase
              .from("contracts")
              .select("id, status")
              .eq("tenancy_id", tenancyId)
              .eq("user_id", userId)
              .eq("status", "draft")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            contractId = (latestContract?.id as string) ?? undefined;
          }
        }

        if (!contractId) {
          return JSON.stringify({
            success: false,
            message: "No draft contract found for this tenant. Please draft a contract first using draft_contract.",
          });
        }

        const { data: contract, error: contractErr } = await supabase
          .from("contracts")
          .select("id, signing_token, status, tenant_id, property_id, tenancy_id, special_clauses")
          .eq("id", contractId)
          .eq("user_id", userId)
          .single();

        if (contractErr || !contract) {
          return JSON.stringify({ success: false, message: "Contract not found or not owned by you" });
        }

        if (contract.status !== "draft") {
          return JSON.stringify({
            success: false,
            message: `Contract is already in "${contract.status}" status — it can only be sent from "draft"`,
          });
        }

        const tenancyId = args.tenancy_id?.trim() || (contract.tenancy_id as string | null);

        const [{ data: tenant }, { data: property }] = await Promise.all([
          supabase
            .from("tenants")
            .select("id, full_name, email")
            .eq("id", contract.tenant_id)
            .single(),
          supabase
            .from("properties")
            .select("id, address, city")
            .eq("id", contract.property_id)
            .single(),
        ]);

        if (!tenant?.email) {
          return JSON.stringify({ success: false, message: "Tenant email is missing — cannot send contract" });
        }
        if (!property) {
          return JSON.stringify({ success: false, message: "Property linked to this contract could not be found" });
        }

        const signingToken = contract.signing_token as string;
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
        const signingUrl = `${appUrl}/sign/${signingToken}`;
        const tenantName = tenant.full_name?.trim() || "Tenant";
        const propertyAddr = [property.address, property.city].filter(Boolean).join(", ");

        await sendEmailTool(supabase, userId, null, {
          to: tenant.email,
          toName: tenantName,
          subject: `Your tenancy agreement for ${propertyAddr} — please sign`,
          body: [
            `Hi ${tenantName},`,
            "",
            `Your landlord has prepared a tenancy agreement for ${propertyAddr}.`,
            "",
            "Please review and sign it by visiting the link below:",
            signingUrl,
            "",
            "This link is unique to you. Do not share it.",
            "",
            "Kind regards,",
            "Letora",
          ].join("\n"),
          agentType: "onboarding",
          forceSend: true,
        });

        void saveEmailDraft(supabase, userId, {
          subject: `Your tenancy agreement for ${propertyAddr} — please sign`,
          body: `Contract signing link sent to ${tenantName} at ${tenant.email}`,
          tenantId: contract.tenant_id as string,
          tenancyId: tenancyId ?? undefined,
          status: "sent",
        });

        await supabase
          .from("contracts")
          .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", contractId)
          .eq("user_id", userId);

        if (tenancyId) {
          const sentAt = new Date().toISOString();
          await supabase
            .from("onboarding_tasks")
            .update({ status: "complete", completed_at: sentAt })
            .eq("tenancy_id", tenancyId)
            .eq("user_id", userId)
            .eq("task_name", "Prepare tenancy agreement (contract not sent by agent)")
            .eq("status", "pending");

          await supabase
            .from("tenancies")
            .update({ onboarding_status: "contract_sent" })
            .eq("id", tenancyId);
        }

        const sendResult = {
          success: true,
          message: `Contract sent to ${tenantName} at ${tenant.email}. They can sign at the link in their email.`,
          signing_url: signingUrl,
          contract_id: contractId,
          tenant_name: tenantName,
          property_address: propertyAddr,
        };

        void logAgentActivity(supabase, userId, "send_contract", args as Record<string, unknown>, sendResult, true);
        return JSON.stringify(sendResult);
      } catch (err: unknown) {
        console.error("[send_contract] exception:", err);
        return JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : String(err),
          code: "internal_error",
        });
      }
    }
    case "send_move_in_email": {
      try {
        let resolvedTenancyId = args.tenancy_id?.trim();

        if (!resolvedTenancyId && args.tenant_name?.trim()) {
          const nameFragment = sanitizeIlikeNameFragment(sanitizeTenantName(args.tenant_name.trim()));
          const { data: tenantHits } = await supabase
            .from("tenants")
            .select("id, tenancies(id)")
            .ilike("full_name", `%${nameFragment}%`)
            .eq("user_id", userId)
            .limit(1);

          const firstHit = tenantHits?.[0];
          if (firstHit) {
            const tenancyRows = normalizeTenancyRows(firstHit.tenancies);
            if (tenancyRows.length === 1 && tenancyRows[0].id) {
              resolvedTenancyId = String(tenancyRows[0].id);
            }
          }
        }

        if (!resolvedTenancyId) {
          return JSON.stringify({
            success: false,
            message: "Pass tenancy_id or tenant_name that resolves to a single tenancy.",
          });
        }

        const enq = await enqueueMoveInEmailApproval(supabase, resolvedTenancyId, userId, { agentRunId: null });
        if (!enq.ok) {
          const failResult = {
            success: false,
            message: enq.error,
          };
          void logAgentActivity(supabase, userId, "send_move_in_email", args as Record<string, unknown>, failResult, false);
          return JSON.stringify(failResult);
        }

        const okResult = {
          success: true,
          pending_approval: true,
          approval_id: enq.id,
          tenancy_id: resolvedTenancyId,
          message: "Move-in instructions email is awaiting your approval in Approvals.",
        };
        void logAgentActivity(supabase, userId, "send_move_in_email", args as Record<string, unknown>, okResult, true);
        return JSON.stringify(okResult);
      } catch (err: unknown) {
        console.error("[send_move_in_email] exception:", err);
        return JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : String(err),
          code: "internal_error",
        });
      }
    }
    case "get_contracts": {
      const tenancyIdArg = args.tenancy_id?.trim();
      const tenantNameArg = args.tenant_name?.trim() ? sanitizeTenantName(args.tenant_name.trim()) : undefined;

      let query = supabase
        .from("contracts")
        .select(`
          id, status, created_at, tenancy_id, tenant_id, property_id,
          tenant_signed_at, landlord_signed_at
        `)
        .eq("user_id", userId);

      if (tenancyIdArg) {
        query = query.eq("tenancy_id", tenancyIdArg);
      }

      const { data: contracts, error: contractsErr } = await query.order("created_at", { ascending: false }).limit(20);

      if (contractsErr || !contracts?.length) {
        return JSON.stringify({ success: false, message: "No contracts found.", contracts: [] });
      }

      let filtered = contracts;
      if (tenantNameArg && !tenancyIdArg) {
        const tenantIds = [...new Set(contracts.map((c) => c.tenant_id).filter((id): id is string => Boolean(id)))];
        if (tenantIds.length > 0) {
          const nameFragment = sanitizeIlikeNameFragment(tenantNameArg);
          const { data: matchingTenants } = await supabase
            .from("tenants")
            .select("id")
            .in("id", tenantIds)
            .ilike("full_name", `%${nameFragment}%`);
          const matchSet = new Set((matchingTenants ?? []).map((t) => t.id as string));
          filtered = contracts.filter((c) => c.tenant_id && matchSet.has(c.tenant_id as string));
        }
      }

      if (filtered.length === 0) {
        return JSON.stringify({ success: false, message: "No contracts found for that tenant.", contracts: [] });
      }

      const tenantIds = [...new Set(filtered.map((c) => c.tenant_id).filter((id): id is string => Boolean(id)))];
      const propertyIds = [...new Set(filtered.map((c) => c.property_id).filter((id): id is string => Boolean(id)))];

      const [{ data: tenants }, { data: properties }] = await Promise.all([
        tenantIds.length > 0
          ? supabase.from("tenants").select("id, full_name, email").in("id", tenantIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
        propertyIds.length > 0
          ? supabase.from("properties").select("id, address, city").in("id", propertyIds)
          : Promise.resolve({ data: [] as { id: string; address: string | null; city: string | null }[] }),
      ]);

      const tenantMap = new Map((tenants ?? []).map((t) => [t.id, t]));
      const propMap = new Map((properties ?? []).map((p) => [p.id, p]));

      const result = filtered.map((c) => {
        const t = c.tenant_id ? tenantMap.get(c.tenant_id as string) : undefined;
        const p = c.property_id ? propMap.get(c.property_id as string) : undefined;
        return {
          contract_id: c.id,
          status: c.status,
          created_at: c.created_at,
          tenancy_id: c.tenancy_id,
          tenant_name: t?.full_name ?? null,
          tenant_email: t?.email ?? null,
          property_address: [p?.address, p?.city].filter(Boolean).join(", ") || null,
          tenant_signed: Boolean(c.tenant_signed_at),
          landlord_signed: Boolean(c.landlord_signed_at),
        };
      });

      return JSON.stringify({ success: true, total: result.length, contracts: result });
    }
    case "resolve_onboarding_navigation": {
      const hrefFor = (id: string) => `/dashboard/tenancies/${id}`;

      const mergeOnboardingSnapshot = async (tenancyId: string, payload: Record<string, unknown>) => {
        const snap = await getOnboardingChatSnapshotForTenancy(supabase, userId, tenancyId);
        if (!snap) return JSON.stringify(payload);
        return JSON.stringify({ ...payload, ...snap });
      };

      const tenancyIdArg = args.tenancy_id?.trim();
      const tenantIdArg = args.tenant_id?.trim();
      const tenantNameArg = args.tenant_name?.trim() ? sanitizeTenantName(args.tenant_name.trim()) : undefined;

      if (tenancyIdArg) {
        const { data: tenancy, error: tErr } = await supabase
          .from("tenancies")
          .select(
            `id, tenants ( full_name ), properties!inner ( user_id, address, city )`,
          )
          .eq("id", tenancyIdArg)
          .maybeSingle();

        if (tErr || !tenancy) {
          return JSON.stringify({ ok: false, code: "not_found", message: "Tenancy not found." });
        }
        const prop = tenancy.properties as unknown as { user_id: string };
        if (prop.user_id !== userId) {
          return JSON.stringify({ ok: false, code: "not_found", message: "Tenancy not found." });
        }
        const tr = tenancy.tenants as unknown as
          | { full_name: string | null }
          | { full_name: string | null }[]
          | null;
        const tn = Array.isArray(tr) ? tr[0] : tr;
        return mergeOnboardingSnapshot(String(tenancy.id), {
          ok: true,
          href: hrefFor(String(tenancy.id)),
          tenancy_id: tenancy.id,
          tenant_name: tn?.full_name?.trim() || null,
        });
      }

      if (!tenantIdArg && !tenantNameArg) {
        return JSON.stringify({
          ok: false,
          code: "needs_tenant",
          message:
            "Pass tenancy_id, tenant_id, or tenant_name — or ask the user which tenant they mean.",
        });
      }

      let resolvedTenantId: string | null = null;

      if (tenantIdArg) {
        if (!looksLikeUuid(tenantIdArg)) {
          return JSON.stringify({
            ok: false,
            code: "invalid_input",
            message: "tenant_id must be a tenant profile UUID from list_tenants. Use tenant_name for a name.",
          });
        }
        const { data: tp } = await supabase
          .from("tenants")
          .select("id")
          .eq("id", tenantIdArg)
          .eq("user_id", userId)
          .maybeSingle();
        if (!tp) {
          return JSON.stringify({ ok: false, code: "not_found", message: "Tenant not found." });
        }
        resolvedTenantId = tp.id as string;
      } else if (tenantNameArg) {
        const tenantResolved = await resolveTenantProfileForAccount(supabase, userId, tenantNameArg);
        if (!tenantResolved.ok) {
          const body = tenantResolved.body;
          if (Array.isArray(body.candidates)) {
            return JSON.stringify({
              ok: false,
              code: "multiple_tenants",
              message:
                typeof body.error === "string"
                  ? body.error
                  : "Multiple tenants matched — ask which one or use tenant_id from list_tenants.",
              candidates: body.candidates,
            });
          }
          return JSON.stringify({
            ok: false,
            code: "needs_tenant",
            message: typeof body.error === "string" ? body.error : "Could not resolve tenant.",
          });
        }
        resolvedTenantId = tenantResolved.tenantId;
      }

      if (!resolvedTenantId) {
        return JSON.stringify({
          ok: false,
          code: "needs_tenant",
          message: "Could not resolve a tenant.",
        });
      }

      const { data: tenRows } = await supabase
        .from("tenancies")
        .select(`id, status, tenants ( full_name ), properties!inner ( user_id, address, city )`)
        .eq("tenant_id", resolvedTenantId);

      const owned = (tenRows ?? []).filter((r) => {
        const p = r.properties as unknown as { user_id: string };
        return p.user_id === userId;
      });

      if (owned.length === 0) {
        return JSON.stringify({
          ok: false,
          code: "not_found",
          message: "No tenancy found for this tenant on your account.",
        });
      }

      if (owned.length === 1) {
        const row = owned[0]!;
        const tr = row.tenants as unknown as
          | { full_name: string | null }
          | { full_name: string | null }[]
          | null;
        const tn = Array.isArray(tr) ? tr[0] : tr;
        return mergeOnboardingSnapshot(String(row.id), {
          ok: true,
          href: hrefFor(String(row.id)),
          tenancy_id: row.id,
          tenant_name: tn?.full_name?.trim() || null,
        });
      }

      const poolForPick = owned.map((r) => ({
        id: r.id as string,
        status: r.status as string | null | undefined,
        properties: r.properties,
      })) as TenancyRowForOnboarding[];

      const picked = pickTenancyForOnboarding(poolForPick, undefined, 0);
      if (picked.status === "picked" || picked.status === "fallback_confirm") {
        const row = owned.find((r) => r.id === picked.tenancy_id);
        const tr = row?.tenants as unknown as
          | { full_name: string | null }
          | { full_name: string | null }[]
          | null;
        const tn = Array.isArray(tr) ? tr[0] : tr;
        return mergeOnboardingSnapshot(picked.tenancy_id, {
          ok: true,
          href: hrefFor(picked.tenancy_id),
          tenancy_id: picked.tenancy_id,
          tenant_name: tn?.full_name?.trim() || null,
        });
      }

      const candidates = owned.map((r) => {
        const p = r.properties as unknown as { address: string | null; city: string | null };
        const addr = [p.address, p.city].filter(Boolean).join(", ") || "Property";
        const tr = r.tenants as unknown as
          | { full_name: string | null }
          | { full_name: string | null }[]
          | null;
        const tn = Array.isArray(tr) ? tr[0] : tr;
        const name = tn?.full_name?.trim() || "Tenant";
        const tid = String(r.id);
        return {
          tenancy_id: tid,
          label: `${name} · ${addr.slice(0, 80)}`,
          href: hrefFor(tid),
        };
      });

      return JSON.stringify({
        ok: false,
        code: "multiple_tenancies",
        message: "Multiple tenancies for this tenant — pick one.",
        candidates,
      });
    }
    case "list_tenants": {
      const { data: raw } = await supabase
        .from("tenants")
        .select(
          "id, full_name, email, tenancies(id, property_id, status, properties(address, city))",
        )
        .eq("user_id", userId)
        .limit(80);

      let tenants = raw ?? [];
      if (args.property_id) {
        tenants = tenants.filter((t) =>
          normalizeTenancyRows(t.tenancies).some((r) => r.property_id === args.property_id),
        );
      }
      if (args.status && args.status !== "all") {
        const want = args.status.toLowerCase();
        tenants = tenants.filter((t) =>
          normalizeTenancyRows(t.tenancies).some((r) => (r.status ?? "").toLowerCase() === want),
        );
      }
      tenants = tenants.slice(0, 50);
      return JSON.stringify({
        total: tenants.length,
        tenants,
      });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
