import type { SupabaseClient } from "@supabase/supabase-js";

import { runTenantOnboardingAgent } from "@/lib/agents/tenant-onboarding";
import {
  arrearsDemoDueDate,
  computeInitialRentDueDate,
} from "@/lib/onboarding/portfolio-import-schema";
import type { BatchOnboardingRow } from "@/lib/onboarding/tenant-import";
import { buildStoredAddressForImport } from "@/lib/onboarding/tenant-import";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { logActivity } from "@/lib/actions/activity-log";

/** Import wrote domain rows but `batch_imports` could not be marked terminal — check logs for `[finalize_failure]` / `zero_rows_updated`. */
export class PortfolioBatchFinalizeError extends Error {
  readonly batchId: string;

  constructor(batchId: string, detail: string) {
    super(
      `Portfolio import finalize failed for batch ${batchId}. Domain data may already be written. Detail: ${detail}`,
    );
    this.name = "PortfolioBatchFinalizeError";
    this.batchId = batchId;
  }
}

function mapRightToRentForPortfolioImport(rowKind: BatchOnboardingRow["rowKind"]): string {
  if (rowKind === "occupied") return "verified";
  return "pending";
}

/**
 * `tenancies.onboarding_status` after portfolio import.
 * - Occupied (incl. legacy): complete — landlords already ran real-world onboarding elsewhere.
 * - Onboarding workflow rows: not_started until the agent promotes in_progress.
 * - Ended: complete so nothing queues as “resume onboarding”.
 */
function portfolioImportTenancyOnboardingStatus(row: BatchOnboardingRow): string {
  if (row.tenancyStatusDb === "ended") return "complete";
  if (row.rowKind === "onboarding") return "not_started";
  return "complete";
}

/**
 * Outcome classification per row AFTER matching but BEFORE inserting.
 * - `new_property`:                property doesn't exist yet; will be created
 * - `matched_property`:            address already in portfolio; reuse it
 * - `existing_tenant`:             tenant with that email already exists; reuse it (still creates tenancy)
 * - `existing_active_tenancy_skip`: an active tenancy already exists for (property, tenant) — skip, not an error
 * - `duplicate_csv_row_skip`:     identical occupancy key appears earlier — skip silently
 * - `vacant_property_only`:       import row only allocates / updates portfolio property wiring
 * - `validation_error`:           parser-level errors prevent any write
 */
export type PreparedRowStatus =
  | "new_property"
  | "matched_property"
  | "existing_tenant"
  | "existing_active_tenancy_skip"
  | "duplicate_csv_row_skip"
  | "vacant_property_only"
  | "validation_error";

export type PreparedRow = {
  /** Index in the input array — useful for UI diff + progress streams. */
  rowIndex: number;
  raw: BatchOnboardingRow;
  /** Human-readable tags ("new property", "existing tenant"). Can have multiple. */
  tags: PreparedRowStatus[];
  /** Detect-only messages (duplicate email display name clashes, postcode hints surfaced earlier, etc.). */
  prepareWarnings: string[];
  /** Pre-resolved property id if matched, else null (a new one will be created). */
  propertyId: string | null;
  /** Pre-resolved tenant id if matched, else null (a new one will be created). */
  tenantId: string | null;
  /** Set when this row will be skipped — already has an active tenancy. */
  skipReason: string | null;
};

export type PreparedBatch = {
  rows: PreparedRow[];
  summary: {
    total: number;
    validationErrors: number;
    newProperties: number;
    matchedProperties: number;
    existingTenants: number;
    skippedActiveTenancies: number;
    duplicateCsvSkips: number;
    warningRows: number;
    actionableRows: number;
  };
};

/**
 * Classify every row: what will happen (new vs matched) without doing any writes.
 * Safe to call repeatedly — purely read-only.
 */
export async function prepareBatchOnboarding(
  rows: BatchOnboardingRow[],
  userId: string,
  supabase: SupabaseClient,
): Promise<PreparedBatch> {
  const emptySummary = {
    total: 0,
    validationErrors: 0,
    newProperties: 0,
    matchedProperties: 0,
    existingTenants: 0,
    skippedActiveTenancies: 0,
    duplicateCsvSkips: 0,
    warningRows: 0,
    actionableRows: 0,
  };

  if (rows.length === 0) {
    return { rows: [], summary: emptySummary };
  }

  const { data: propertyRows } = await supabase
    .from("properties")
    .select("id, address, city, postcode")
    .eq("user_id", userId);

  const normalizeAddr = (addr: string, city: string | null): string => {
    const base = normalizePropertyAddressLabel(addr) || addr.trim();
    const withCity = city ? `${base}, ${city}` : base;
    return withCity.toLowerCase().replace(/\s+/g, " ").trim();
  };

  const propertyIndex = new Map<string, string>();
  for (const p of propertyRows ?? []) {
    const row = p as { id: string; address: string | null; city: string | null };
    const key = normalizeAddr(row.address ?? "", row.city);
    if (key && !propertyIndex.has(key)) propertyIndex.set(key, row.id);
  }

  const tenantEmails = Array.from(
    new Set(
      rows
        .filter((r) => r.rowKind !== "vacant")
        .map((r) => r.tenantEmail.trim().toLowerCase())
        .filter((e) => e.length > 0),
    ),
  );

  const tenantEmailToId = new Map<string, string>();
  const tenantIdToProfile = new Map<string, { full_name: string | null; email: string | null }>();

  if (tenantEmails.length > 0) {
    const { data: tenantRows } = await supabase
      .from("tenants")
      .select("id, email, full_name")
      .eq("user_id", userId)
      .in("email", tenantEmails);
    for (const t of tenantRows ?? []) {
      const row = t as { id: string; email: string | null; full_name: string | null };
      if (row.email) tenantEmailToId.set(row.email.toLowerCase(), row.id);
      tenantIdToProfile.set(row.id, { full_name: row.full_name ?? null, email: row.email ?? null });
    }
  }

  const tenantIds = Array.from(tenantEmailToId.values());
  const activePairs = new Set<string>();
  if (tenantIds.length > 0) {
    const { data: tenancyRows } = await supabase
      .from("tenancies")
      .select("property_id, tenant_id, status")
      .in("tenant_id", tenantIds)
      .eq("status", "active");
    for (const row of tenancyRows ?? []) {
      const t = row as { property_id: string | null; tenant_id: string | null; status: string | null };
      if (t.property_id && t.tenant_id) {
        activePairs.add(`${t.property_id}:${t.tenant_id}`);
      }
    }
  }

  const csvOccurrenceKey = (raw: BatchOnboardingRow): string => {
    const propKey = normalizeAddr(raw.propertyAddress, raw.city);
    if (!propKey) return "";
    if (raw.rowKind === "vacant") return `${propKey}||vacant`;
    return `${propKey}|${raw.tenantEmail.trim().toLowerCase()}`;
  };

  const csvSeen = new Set<string>();

  const prepared: PreparedRow[] = rows.map((raw, rowIndex) => {
    const prepareWarnings = [...raw.rowWarnings];

    if (raw.rowErrors.length > 0) {
      return {
        rowIndex,
        raw,
        tags: ["validation_error"],
        prepareWarnings,
        propertyId: null,
        tenantId: null,
        skipReason: null,
      };
    }

    const tags: PreparedRowStatus[] = [];

    if (raw.rowKind === "vacant") tags.push("vacant_property_only");

    const propKey = normalizeAddr(raw.propertyAddress, raw.city);
    const matchedPropertyId = propKey ? (propertyIndex.get(propKey) ?? null) : null;

    const emailKey =
      raw.rowKind === "vacant" ? "" : raw.tenantEmail.trim().toLowerCase();
    const matchedTenantId = emailKey ? (tenantEmailToId.get(emailKey) ?? null) : null;

    if (raw.rowKind !== "vacant") {
      tags.push(matchedPropertyId ? "matched_property" : "new_property");
      if (matchedTenantId) tags.push("existing_tenant");
    } else {
      tags.push(matchedPropertyId ? "matched_property" : "new_property");
    }

    if (matchedTenantId && raw.rowKind !== "vacant") {
      const profile = tenantIdToProfile.get(matchedTenantId);
      const existingName = (profile?.full_name ?? "").trim().toLowerCase();
      const rowName = raw.tenantFullName.trim().toLowerCase();
      if (
        profile &&
        profile.full_name &&
        existingName !== rowName &&
        rowName.length > 2
      ) {
        prepareWarnings.push(
          `This email matches an existing tenant named "${profile.full_name.trim()}". Names differ from this row (${raw.tenantFullName}). Letora keeps one tenant profile per email.`,
        );
      }
    }

    let skipReason: string | null = null;
    if (raw.rowKind !== "vacant" && matchedPropertyId && matchedTenantId) {
      const pair = `${matchedPropertyId}:${matchedTenantId}`;
      if (activePairs.has(pair)) {
        tags.push("existing_active_tenancy_skip");
        skipReason = "Active tenancy already exists for this property and tenant.";
      }
    }

    /* Duplicates measured only on actionable rows once basic validation succeeded. */
    const occKey = csvOccurrenceKey(raw);
    if (occKey) {
      if (csvSeen.has(occKey)) {
        tags.push("duplicate_csv_row_skip");
        skipReason =
          skipReason ??
          "Removed as a duplicate of an earlier spreadsheet row at the same property (and tenant, if occupied).";
      } else {
        csvSeen.add(occKey);
      }
    }

    return {
      rowIndex,
      raw,
      tags,
      prepareWarnings,
      propertyId: matchedPropertyId,
      tenantId: matchedTenantId,
      skipReason,
    };
  });

  const summary = {
    total: prepared.length,
    validationErrors: prepared.filter((r) => r.tags.includes("validation_error")).length,
    newProperties: prepared.filter((r) => r.tags.includes("new_property")).length,
    matchedProperties: prepared.filter((r) => r.tags.includes("matched_property")).length,
    existingTenants: prepared.filter((r) => r.tags.includes("existing_tenant")).length,
    skippedActiveTenancies: prepared.filter((r) =>
      r.tags.includes("existing_active_tenancy_skip"),
    ).length,
    duplicateCsvSkips: prepared.filter((r) => r.tags.includes("duplicate_csv_row_skip")).length,
    warningRows: prepared.filter((r) => r.prepareWarnings.length > 0).length,
    actionableRows: prepared.filter(
      (r) =>
        !r.tags.includes("validation_error") &&
        !r.tags.includes("existing_active_tenancy_skip") &&
        !r.tags.includes("duplicate_csv_row_skip"),
    ).length,
  };

  return { rows: prepared, summary };
}

/* ─────────────────────── Executor ─────────────────────── */

export type BatchRowOutcome = {
  rowIndex: number;
  status: "created" | "resumed" | "skipped" | "error";
  propertyId: string | null;
  tenantId: string | null;
  tenancyId: string | null;
  emailStatus: "sent" | "draft" | "failed" | "skipped" | null;
  error?: string;
  /** Row ran `runTenantOnboardingAgent` (used for aggregates / logging only). */
  onboardingAgentInvoked?: boolean;
};

export type BatchRunResult = {
  batchId: string;
  totals: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    agentsTriggered: number;
    approvalsCreated: number;
  };
  outcomes: BatchRowOutcome[];
};

export type PortfolioImportStoredRowOutcome = {
  rowIndex: number;
  line: number;
  rowKind: string;
  propertyAddress: string;
  tenantFullName: string;
  tenantEmail: string;
  tags: string[];
  previewErrors: string[];
  previewWarnings: string[];
  prepareWarnings: string[];
  skipReason: string | null;
  outcome: string;
  runtimeError?: string;
  propertyId: string | null;
  tenantId: string | null;
  tenancyId: string | null;
  emailStatus: string | null;
};

function buildPortfolioImportOutcomesSnapshot(
  prepared: PreparedBatch,
  outcomes: BatchRowOutcome[],
): PortfolioImportStoredRowOutcome[] {
  const byIdx = new Map<number, BatchRowOutcome>();
  for (const o of outcomes) {
    byIdx.set(o.rowIndex, o);
  }

  return prepared.rows.map((pr) => {
    const o = byIdx.get(pr.rowIndex);
    return {
      rowIndex: pr.rowIndex,
      line: pr.rowIndex + 1,
      rowKind: pr.raw.rowKind,
      propertyAddress: pr.raw.propertyAddress,
      tenantFullName: pr.raw.tenantFullName ?? "",
      tenantEmail: pr.raw.tenantEmail ?? "",
      tags: [...pr.tags],
      previewErrors: [...pr.raw.rowErrors],
      previewWarnings: [...pr.raw.rowWarnings],
      prepareWarnings: [...pr.prepareWarnings],
      skipReason: pr.skipReason,
      outcome: o?.status ?? "error",
      runtimeError: typeof o?.error === "string" ? o.error : undefined,
      propertyId: o?.propertyId ?? pr.propertyId,
      tenantId: o?.tenantId ?? pr.tenantId,
      tenancyId: o?.tenancyId ?? null,
      emailStatus: o?.emailStatus ?? null,
    };
  });
}

export type BatchRunOptions = {
  /** Called after each row finishes — useful for streaming progress to a UI. */
  onProgress?: (outcome: BatchRowOutcome, totals: BatchRunResult["totals"]) => void;
  /** Defaults to 1 — avoids intra-batch duplicate property races while still allowing higher limits for tooling. */
  concurrency?: number;
};

function summarizeBatchRunTotalsFromOutcomes(
  rowsTotal: number,
  outcomes: BatchRowOutcome[],
): { totals: BatchRunResult["totals"]; errorsLog: Array<{ row_index: number; error: string }> } {
  const errorsLog: Array<{ row_index: number; error: string }> = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let agentsTriggered = 0;
  let approvalsCreated = 0;

  for (const o of outcomes) {
    if (o.status === "error") {
      failed += 1;
      if (o.error) errorsLog.push({ row_index: o.rowIndex, error: o.error });
    } else if (o.status === "skipped") {
      skipped += 1;
    } else if (o.status === "created" || o.status === "resumed") {
      succeeded += 1;
      if (o.onboardingAgentInvoked) agentsTriggered += 1;
      if (o.emailStatus === "draft") approvalsCreated += 1;
    }
  }

  return {
    totals: {
      total: rowsTotal,
      succeeded,
      failed,
      skipped,
      agentsTriggered,
      approvalsCreated,
    },
    errorsLog,
  };
}

function terminalBatchStatusFromTotals(totals: BatchRunResult["totals"]): "completed" | "failed" {
  if (totals.failed === 0) return "completed";
  if (totals.succeeded === 0) return "failed";
  return "completed";
}

/** Drop columns that older DBs might not yet have (migration not applied locally). */
function stripUnsupportedBatchImportPayloadColumns(patch: Record<string, unknown>): Record<string, unknown> {
  const p = { ...patch };
  delete p.agents_triggered;
  delete p.approvals_created;
  delete p.outcomes_json;
  delete p.finalize_error;
  return p;
}

async function writeBatchImportFinalizeAttempt(
  supabase: SupabaseClient,
  batchId: string,
  userId: string,
  phase: string,
  patch: Record<string, unknown>,
): Promise<
  | { ok: true }
  | { ok: false; reason: "supabase_error"; code?: string; message: string }
  | { ok: false; reason: "zero_rows"; message: string }
> {
  console.info("[batch_import][finalize_attempt]", {
    batchId,
    phase,
    patchKeys: Object.keys(patch),
  });

  const { data, error } = await supabase
    .from("batch_imports")
    .update(patch)
    .eq("id", batchId)
    .eq("user_id", userId)
    .select("id, status, completed_at")
    .maybeSingle();

  if (error) {
    console.error("[batch_import][finalize_failure]", {
      batchId,
      phase,
      mode: "supabase_error",
      code: error.code,
      message: error.message,
    });
    return { ok: false, reason: "supabase_error", code: error.code, message: error.message };
  }

  if (!data) {
    const msg =
      "UPDATE touched 0 rows under id+user_id filters. Typical causes: RLS denies UPDATE, JWT user_id mismatched the inserting session, wrong batch UUID, or the row was deleted.";
    console.error("[batch_import][finalize_failure]", {
      batchId,
      phase,
      mode: "zero_rows_updated",
      message: msg,
    });
    return { ok: false, reason: "zero_rows", message: msg };
  }

  console.info("[batch_import][finalize_success]", {
    batchId,
    phase,
    observedStatus: data.status,
    completedAt: data.completed_at,
  });

  return { ok: true };
}

async function persistBatchImportTermination(
  supabase: SupabaseClient,
  batchId: string,
  userId: string,
  updatePayload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const failureNotes: string[] = [];

  type AttemptResult =
    | { ok: true }
    | { ok: false; reason: "supabase_error"; code?: string; message: string }
    | { ok: false; reason: "zero_rows"; message: string };

  const bump = async (payload: Record<string, unknown>, phase: string): Promise<AttemptResult> => {
    const attempt = await writeBatchImportFinalizeAttempt(
      supabase,
      batchId,
      userId,
      phase,
      payload,
    );
    if (attempt.ok) {
      return { ok: true };
    }
    failureNotes.push(
      `${phase}: ${attempt.reason === "supabase_error" ? `pg ${attempt.code ?? "?"} ${attempt.message}` : attempt.message}`,
    );
    return attempt;
  };

  let r = await bump({ ...updatePayload }, "payload_full");
  if (r.ok) return { ok: true };

  if (r.reason === "supabase_error" && r.code === "42703") {
    r = await bump(stripUnsupportedBatchImportPayloadColumns({ ...updatePayload }), "strip_42703_columns");
    if (r.ok) return { ok: true };
  }

  if (!r.ok) {
    const minimal: Record<string, unknown> = {
      status: updatePayload.status,
      completed_at: updatePayload.completed_at,
      rows_succeeded: updatePayload.rows_succeeded,
      rows_failed: updatePayload.rows_failed,
      errors_json: updatePayload.errors_json,
      finalize_error: failureNotes.slice(-4).join(" | ").slice(0, 1900),
    };

    let rMin = await bump(minimal, "minimal_counters_plus_finalize_error");
    if (!rMin.ok && rMin.reason === "supabase_error" && rMin.code === "42703") {
      delete minimal.finalize_error;
      rMin = await bump(minimal, "minimal_counters_only");
    }
    if (rMin.ok) return { ok: true };
    r = rMin;
  }

  if (!r.ok) {
    const doom: Record<string, unknown> = {
      status: "failed",
      completed_at: new Date().toISOString(),
      finalize_error: `${failureNotes.join(" || ")} | forcing failed`.slice(0, 1900),
      errors_json: [
        {
          row_index: -1,
          error:
            failureNotes.join("; ") ||
            "All portfolio-import finalize payloads failed — see finalize_error.",
        },
      ],
    };

    let rDoom = await bump(doom, "doom_failed_with_finalize_error");
    if (!rDoom.ok && rDoom.reason === "supabase_error" && rDoom.code === "42703") {
      delete doom.finalize_error;
      rDoom = await bump(doom, "doom_failed_without_finalize_error_col");
    }
    if (rDoom.ok) return { ok: true };
    r = rDoom;
  }

  if (r.ok) {
    return { ok: true };
  }

  const detail =
    r.reason === "supabase_error" ? `[${r.code ?? "?"}] ${r.message}` : r.message;

  console.error("[batch_import][finalize_failure]", {
    batchId,
    phase: "exhausted",
    exhaustedAllKnownPaths: true,
    attemptsSummary: failureNotes,
    lastError: detail,
  });

  return {
    ok: false,
    message: `persistBatchImportTermination exhausted retries (${failureNotes.join(" · ") || detail})`,
  };
}

/**
 * Executes a prepared batch: creates property/tenant/tenancy rows as needed.
 * - **row_kind onboarding** (non-ended): runs the tenant onboarding agent (welcome email path).
 * - **row_kind occupied** (including legacy imports where `row_kind` was missing and inferred) or ended tenancies:
 *   skips that agent; live rows use `tenancies.onboarding_status = complete` so rent/arrears work without re-onboarding.
 *
 * Portfolio import runs **sequentially** (one row at a time) so address memo + idempotency checks stay deterministic.
 * The `concurrency` option is accepted for API compatibility but values > 1 are ignored with a warning.
 *
 * Assumes rows have already been validated by `prepareBatchOnboarding`.
 */
export async function runBatchOnboarding(
  prepared: PreparedBatch,
  userId: string,
  supabase: SupabaseClient,
  options: BatchRunOptions = {},
): Promise<BatchRunResult> {
  const requestedConcurrency = options.concurrency ?? 1;

  const normalizeAddr = (addr: string, city: string | null): string => {
    const base = normalizePropertyAddressLabel(addr) || addr.trim();
    const withCity = city ? `${base}, ${city}` : base;
    return withCity.toLowerCase().replace(/\s+/g, " ").trim();
  };

  const startedAt = Date.now();

  await logActivity(
    {
      userId,
      eventType: "PORTFOLIO_IMPORT_STARTED",
      source: "system",
      args: {
        message: `Started importing portfolio (${prepared.summary.actionableRows} actionable rows)`,
        actionableRows: prepared.summary.actionableRows,
      },
    },
    supabase,
  );

  const { data: batchInsert, error: batchErr } = await supabase
    .from("batch_imports")
    .insert({
      user_id: userId,
      kind: "tenant_onboarding",
      status: "running",
      rows_total: prepared.rows.length,
      rows_succeeded: 0,
      rows_failed: 0,
      errors_json: [],
    })
    .select("id")
    .single();

  if (batchErr || !batchInsert) {
    throw new Error(`Could not create batch record: ${batchErr?.message ?? "unknown error"}`);
  }
  const batchId = batchInsert.id as string;
  const logTag = `[batch_import] batchId=${batchId}`;

  console.info(`${logTag} execution start rows=${prepared.rows.length}`);

  if (requestedConcurrency > 1) {
    console.warn(
      `${logTag} concurrency=${requestedConcurrency} ignored — portfolio executor is sequential`,
    );
  }

  /** Intra-batch dedupe: same normalized address as `prepareBatchOnboarding` maps to one runtime property row. */
  const batchPropertyByKey = new Map<string, string>();

  async function processPreparedRow(row: PreparedRow): Promise<BatchRowOutcome> {
    const outcome: BatchRowOutcome = {
      rowIndex: row.rowIndex,
      status: "error",
      propertyId: row.propertyId,
      tenantId: row.tenantId,
      tenancyId: null,
      emailStatus: null,
    };

    try {
      if (row.tags.includes("validation_error")) {
        outcome.status = "error";
        outcome.error = row.raw.rowErrors.join("; ");

        await logActivity(
          {
            userId,
            eventType: "PORTFOLIO_IMPORT_ROW_ERROR",
            source: "system",
            success: false,
            args: {
              message: `Row ${row.rowIndex + 1} failed: ${outcome.error}`,
              rowIndex: row.rowIndex,
              property: row.raw.propertyAddress,
              error: outcome.error,
            },
          },
          supabase,
        );
        return outcome;
      }

      if (row.tags.includes("duplicate_csv_row_skip")) {
        outcome.status = "skipped";
        return outcome;
      }

      if (row.tags.includes("existing_active_tenancy_skip")) {
        outcome.status = "skipped";
        return outcome;
      }

      const propertyAddressStored =
        normalizePropertyAddressLabel(
          buildStoredAddressForImport(row.raw.propertyDisplayName, row.raw.propertyAddress),
        ) || buildStoredAddressForImport(row.raw.propertyDisplayName, row.raw.propertyAddress);

      const pk = normalizeAddr(row.raw.propertyAddress, row.raw.city);
      if (pk.length > 0 && row.propertyId) {
        batchPropertyByKey.set(pk, row.propertyId);
      }

      /** Vacancy row referencing an existing property — no inserts. */
      if (row.tags.includes("vacant_property_only") && row.raw.rowKind === "vacant" && row.propertyId) {
        outcome.propertyId = row.propertyId;
        outcome.status = "skipped";
        outcome.emailStatus = "skipped";
        return outcome;
      }

      let propertyId: string | null =
        row.propertyId ?? (pk.length > 0 ? (batchPropertyByKey.get(pk) ?? null) : null);

      if (!propertyId) {
        propertyId = crypto.randomUUID();
        const { error: propErr } = await supabase.from("properties").insert({
          id: propertyId,
          user_id: userId,
          address: propertyAddressStored,
          postcode: row.raw.postcode ?? "",
          city: row.raw.city ?? "",
          property_type:
            row.raw.propertyType && row.raw.propertyType.trim().length > 0
              ? row.raw.propertyType.trim().slice(0, 80)
              : "Flat",
          bedrooms: row.raw.bedrooms ?? 1,
          bathrooms: row.raw.bathrooms ?? 1,
          monthly_rent: row.raw.monthlyRent,
          status: row.raw.rowKind === "vacant" ? "vacant" : "active",
          has_gas_supply: true,
        });
        if (propErr) throw new Error(`property insert failed: ${propErr.message}`);
        outcome.propertyId = propertyId;
        if (pk.length > 0) batchPropertyByKey.set(pk, propertyId);
      } else if (pk.length > 0) {
        batchPropertyByKey.set(pk, propertyId);
        outcome.propertyId = propertyId;
      }

      /**
       * Property-only imports: never attach tenant / tenancy regardless of tagging drift during prepare.
       */
      if (row.raw.rowKind === "vacant" || row.tags.includes("vacant_property_only")) {
        outcome.propertyId = propertyId;
        outcome.status = "created";
        outcome.emailStatus = "skipped";
        return outcome;
      }

      const emailTrim = row.raw.tenantEmail.trim();

      let tenantId: string | null = row.tenantId;
      if (!tenantId && emailTrim.length > 0) {
        const { data: tenantRow } = await supabase
          .from("tenants")
          .select("id")
          .eq("user_id", userId)
          .eq("email", emailTrim)
          .maybeSingle();
        if (tenantRow?.id) tenantId = tenantRow.id as string;
      }

      if (!tenantId) {
        tenantId = crypto.randomUUID();
        const { error: tenantErr } = await supabase.from("tenants").insert({
          id: tenantId,
          user_id: userId,
          full_name: row.raw.tenantFullName,
          email: row.raw.tenantEmail,
          phone: row.raw.tenantPhone,
          right_to_rent_status: mapRightToRentForPortfolioImport(row.raw.rowKind),
        });
        if (tenantErr) throw new Error(`tenant insert failed: ${tenantErr.message}`);
      }

      outcome.tenantId = tenantId;

      const { data: activeTenancy } = await supabase
        .from("tenancies")
        .select("id")
        .eq("property_id", propertyId)
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .maybeSingle();

      if (activeTenancy?.id) {
        outcome.propertyId = propertyId;
        outcome.tenantId = tenantId;
        outcome.tenancyId = activeTenancy.id as string;
        outcome.status = "skipped";
        outcome.emailStatus = "skipped";
        return outcome;
      }

      const tenancyId = crypto.randomUUID();

      const deposit =
        row.raw.depositAmount != null ? row.raw.depositAmount : row.raw.monthlyRent;

      const { error: tenancyErr } = await supabase.from("tenancies").insert({
        id: tenancyId,
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: row.raw.startDate,
        end_date: row.raw.endDate,
        move_in_date: row.raw.moveInDate ?? row.raw.startDate,
        monthly_rent: row.raw.monthlyRent,
        deposit_amount: deposit ?? null,
        status: row.raw.tenancyStatusDb,
        onboarding_status: portfolioImportTenancyOnboardingStatus(row.raw),
      });
      if (tenancyErr) throw new Error(`tenancy insert failed: ${tenancyErr.message}`);
      outcome.tenancyId = tenancyId;

      const shouldSeedRent =
        row.raw.monthlyRent > 0 &&
        row.raw.startDate.length > 0 &&
        (row.raw.tenancyStatusDb === "active" || row.raw.tenancyStatusDb === "pending");

      if (shouldSeedRent) {
        let dueDate =
          row.raw.rentDueDay != null && row.raw.rentDueDay > 0
            ? computeInitialRentDueDate(row.raw.startDate, row.raw.rentDueDay)
            : row.raw.startDate;
        let payStatus: "pending" | "overdue" = "pending";

        if (row.raw.rentPosition === "arrears") {
          dueDate = arrearsDemoDueDate(row.raw.startDate);
          payStatus = "overdue";
        }

        const { error: rpErr } = await supabase.from("rent_payments").insert({
          id: crypto.randomUUID(),
          user_id: userId,
          tenancy_id: tenancyId,
          property_id: propertyId,
          tenant_id: tenantId,
          amount: row.raw.monthlyRent,
          due_date: dueDate,
          status: payStatus,
          notes: row.raw.notes ?? null,
        });

        if (rpErr)
          console.error(`${logTag} rent_payment seed tenancyId=${tenancyId}`, {
            message: rpErr.message,
          });
      }

      const shouldRunOnboardingAgent =
        row.raw.rowKind === "onboarding" && row.raw.tenancyStatusDb !== "ended";
      if (!shouldRunOnboardingAgent) {
        outcome.emailStatus = "skipped";
        outcome.status = "created";
        return outcome;
      }

      outcome.onboardingAgentInvoked = true;
      const agentResult = await runTenantOnboardingAgent(tenancyId, userId, supabase);
      outcome.emailStatus = agentResult.emailStatus;
      outcome.status = agentResult.mode === "resume" ? "resumed" : "created";

      if (agentResult.emailStatus === "draft") {
        await logActivity(
          {
            userId,
            eventType: "PORTFOLIO_IMPORT_APPROVAL_REQUESTED",
            source: "system",
            args: {
              message: `Drafted welcome email for ${row.raw.tenantFullName} (approval required)`,
              tenancyId,
              tenantName: row.raw.tenantFullName,
            },
          },
          supabase,
        );
      } else {
        await logActivity(
          {
            userId,
            eventType: "PORTFOLIO_IMPORT_AGENT_STARTED",
            source: "system",
            args: {
              message: `Agent started onboarding tasks for ${row.raw.tenantFullName}`,
              tenancyId,
              tenantName: row.raw.tenantFullName,
            },
          },
          supabase,
        );
      }

      return outcome;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outcome.status = "error";
      outcome.error = msg;

      await logActivity(
        {
          userId,
          eventType: "PORTFOLIO_IMPORT_ROW_ERROR",
          source: "system",
          success: false,
          args: {
            message: `Row ${row.rowIndex + 1} failed: ${msg}`,
            error: msg,
          },
        },
        supabase,
      );
      return outcome;
    }
  }

  const outcomes: BatchRowOutcome[] = [];

  for (const row of prepared.rows) {
    const o = await processPreparedRow(row);
    outcomes.push(o);
    const { totals: progressTotals } = summarizeBatchRunTotalsFromOutcomes(prepared.rows.length, outcomes);
    options.onProgress?.(o, progressTotals);
  }

  const summed = summarizeBatchRunTotalsFromOutcomes(prepared.rows.length, outcomes);
  const totals = summed.totals;
  const errorsLog = summed.errorsLog;

  const outcomesSnapshot = buildPortfolioImportOutcomesSnapshot(prepared, outcomes);
  const finalStatus = terminalBatchStatusFromTotals(totals);
  const completedAt = new Date().toISOString();

  const insertCount = outcomes.filter((o) => o.status === "created" || o.status === "resumed").length;

  console.info(`${logTag} rows processed=${outcomes.length}`, {
    rowsInsertedEstimated: insertCount,
    rowsSkipped: totals.skipped,
    rowsFailed: totals.failed,
    finalStatus,
    elapsedMs: Date.now() - startedAt,
  });

  const updatePayload: Record<string, unknown> = {
    status: finalStatus,
    rows_succeeded: totals.succeeded,
    rows_failed: totals.failed,
    agents_triggered: totals.agentsTriggered,
    approvals_created: totals.approvalsCreated,
    errors_json: errorsLog,
    outcomes_json: outcomesSnapshot,
    completed_at: completedAt,
  };

  const persisted = await persistBatchImportTermination(supabase, batchId, userId, updatePayload);
  if (!persisted.ok) {
    console.error(`${logTag} finalize did not persist`, { message: persisted.message });
    throw new PortfolioBatchFinalizeError(batchId, persisted.message);
  }

  const { data: verify, error: verifyErr } = await supabase
    .from("batch_imports")
    .select("id, status, completed_at")
    .eq("id", batchId)
    .eq("user_id", userId)
    .maybeSingle();

  console.info("[batch_import][read_after_finalize]", {
    batchId,
    verifyErr: verifyErr?.message,
    observedStatus: verify?.status,
    completedAt: verify?.completed_at,
  });

  if (verifyErr) {
    throw new PortfolioBatchFinalizeError(
      batchId,
      `Post-finalize SELECT failed: ${verifyErr.message}`,
    );
  }
  if (!verify || verify.status === "running") {
    throw new PortfolioBatchFinalizeError(
      batchId,
      "Post-finalize verification still shows status=running — batch_imports UPDATE likely matched 0 rows or RLS blocked the write.",
    );
  }

  console.info(`${logTag} execution end`, {
    finalStatus,
    observedStatus: verify.status,
    totals,
  });

  await logActivity(
    {
      userId,
      eventType: "PORTFOLIO_IMPORT_COMPLETED",
      source: "system",
      args: {
        message: `Portfolio import finished: ${totals.succeeded} successful, ${totals.failed} failed`,
        succeeded: totals.succeeded,
        failed: totals.failed,
        batchId,
        persisted_ok: true,
        terminal_status: verify.status,
      },
    },
    supabase,
  );

  return {
    batchId,
    totals,
    outcomes,
  };
}
