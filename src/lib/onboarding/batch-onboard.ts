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

export type BatchRunOptions = {
  /** Called after each row finishes — useful for streaming progress to a UI. */
  onProgress?: (outcome: BatchRowOutcome, totals: BatchRunResult["totals"]) => void;
  /** Defaults to 3. Welcome emails go through Resend; keep it polite. */
  concurrency?: number;
};

/**
 * Minimal concurrency limiter (avoids adding a `p-limit` dep just for this).
 * Runs `fn(input, index)` over `items`, up to `limit` in flight at a time.
 * Preserves insertion order in the returned array.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers: Promise<void>[] = [];
  const workerCount = Math.max(1, Math.min(limit, items.length));
  for (let w = 0; w < workerCount; w++) {
    workers.push(
      (async () => {
        while (true) {
          const i = next++;
          if (i >= items.length) return;
          results[i] = await fn(items[i]!, i);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return results;
}

/**
 * Executes a prepared batch: creates property/tenant/tenancy rows as needed,
 * then fires the existing tenant-onboarding agent (welcome email + 8 tasks).
 * Idempotent: re-running the same CSV only creates what's missing.
 *
 * Assumes rows have already been validated by `prepareBatchOnboarding`.
 * Uses the provided supabase client directly — when called from a CEO tool
 * pass the request-scoped client; when called from an API route pass a
 * server-side client authenticated as the landlord.
 */
export async function runBatchOnboarding(
  prepared: PreparedBatch,
  userId: string,
  supabase: SupabaseClient,
  options: BatchRunOptions = {},
): Promise<BatchRunResult> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 5));

  // Log Import Started
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

  const totals: BatchRunResult["totals"] = {
    total: prepared.rows.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    agentsTriggered: 0,
    approvalsCreated: 0,
  };
  const errorsLog: Array<{ row_index: number; error: string }> = [];

  const outcomes = await mapWithConcurrency(prepared.rows, concurrency, async (row) => {
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
        totals.failed += 1;
        errorsLog.push({ row_index: row.rowIndex, error: outcome.error ?? "" });

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

        options.onProgress?.(outcome, { ...totals });
        return outcome;
      }

      if (row.tags.includes("duplicate_csv_row_skip")) {
        outcome.status = "skipped";
        totals.skipped += 1;
        options.onProgress?.(outcome, { ...totals });
        return outcome;
      }

      if (row.tags.includes("existing_active_tenancy_skip")) {
        outcome.status = "skipped";
        totals.skipped += 1;
        options.onProgress?.(outcome, { ...totals });
        return outcome;
      }

      const propertyAddressStored =
        normalizePropertyAddressLabel(
          buildStoredAddressForImport(row.raw.propertyDisplayName, row.raw.propertyAddress),
        ) || buildStoredAddressForImport(row.raw.propertyDisplayName, row.raw.propertyAddress);

      /** Vacancy row referencing an existing property — no inserts. */
      if (row.tags.includes("vacant_property_only") && row.raw.rowKind === "vacant" && row.propertyId) {
        outcome.propertyId = row.propertyId;
        outcome.status = "skipped";
        totals.skipped += 1;
        options.onProgress?.(outcome, { ...totals });
        return outcome;
      }

      let propertyId = row.propertyId;
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
      }

      if (row.tags.includes("vacant_property_only") && row.raw.rowKind === "vacant") {
        outcome.status = "created";
        outcome.emailStatus = "skipped";
        totals.succeeded += 1;
        options.onProgress?.(outcome, { ...totals });
        return outcome;
      }

      let tenantId = row.tenantId;
      if (!tenantId) {
        tenantId = crypto.randomUUID();
        const { error: tenantErr } = await supabase.from("tenants").insert({
          id: tenantId,
          user_id: userId,
          full_name: row.raw.tenantFullName,
          email: row.raw.tenantEmail,
          phone: row.raw.tenantPhone,
          right_to_rent_status: "pending",
        });
        if (tenantErr) throw new Error(`tenant insert failed: ${tenantErr.message}`);
        outcome.tenantId = tenantId;
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
        onboarding_status: row.raw.rowKind === "onboarding" ? "in_progress" : "not_started",
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
          console.error(
            `[runBatchOnboarding] rent_payment seed tenancyId=${tenancyId} message=${rpErr.message}`,
          );
      }

      const shouldRunAgent = row.raw.tenancyStatusDb !== "ended";
      if (!shouldRunAgent) {
        outcome.emailStatus = "skipped";
        outcome.status = "created";
        totals.succeeded += 1;
        options.onProgress?.(outcome, { ...totals });
        return outcome;
      }

      const agentResult = await runTenantOnboardingAgent(tenancyId, userId, supabase);
      outcome.emailStatus = agentResult.emailStatus;
      outcome.status = agentResult.mode === "resume" ? "resumed" : "created";
      totals.succeeded += 1;
      totals.agentsTriggered += 1;

      if (agentResult.emailStatus === "draft") {
        totals.approvalsCreated += 1;
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

      options.onProgress?.(outcome, { ...totals });
      return outcome;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outcome.status = "error";
      outcome.error = msg;
      totals.failed += 1;
      errorsLog.push({ row_index: row.rowIndex, error: msg });

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

      options.onProgress?.(outcome, { ...totals });
      return outcome;
    }
  });

  const finalStatus = totals.failed === 0 ? "completed" : totals.succeeded === 0 ? "failed" : "completed";
  const updatePayload: Record<string, unknown> = {
    status: finalStatus,
    rows_succeeded: totals.succeeded,
    rows_failed: totals.failed,
    agents_triggered: totals.agentsTriggered,
    approvals_created: totals.approvalsCreated,
    errors_json: errorsLog,
    completed_at: new Date().toISOString(),
  };

  const { error: updateErr } = await supabase
    .from("batch_imports")
    .update(updatePayload)
    .eq("id", batchId)
    .eq("user_id", userId);

  // Resilience: Fallback if migration hasn't run
  if (updateErr?.code === "42703") {
    const fallbackPayload = { ...updatePayload };
    delete fallbackPayload.agents_triggered;
    delete fallbackPayload.approvals_created;

    await supabase
      .from("batch_imports")
      .update(fallbackPayload)
      .eq("id", batchId)
      .eq("user_id", userId);
  }

  // Log Import Completed
  await logActivity(
    {
      userId,
      eventType: "PORTFOLIO_IMPORT_COMPLETED",
      source: "system",
      args: {
        message: `Portfolio import finished: ${totals.succeeded} successful, ${totals.failed} failed`,
        succeeded: totals.succeeded,
        failed: totals.failed,
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
