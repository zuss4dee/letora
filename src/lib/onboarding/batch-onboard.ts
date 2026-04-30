import type { SupabaseClient } from "@supabase/supabase-js";

import { runTenantOnboardingAgent } from "@/lib/agents/tenant-onboarding";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
import type { BatchOnboardingRow } from "@/lib/onboarding/tenant-import";
import { logActivity } from "@/lib/actions/activity-log";

/**
 * Outcome classification per row AFTER matching but BEFORE inserting.
 * - `new_property`:                property doesn't exist yet; will be created
 * - `matched_property`:            address already in portfolio; reuse it
 * - `existing_tenant`:             tenant with that email already exists; reuse it (still creates tenancy)
 * - `existing_active_tenancy_skip`: an active tenancy already exists for (property, tenant) — skip, not an error
 * - `validation_error`:            parser-level errors prevent any write
 */
export type PreparedRowStatus =
  | "new_property"
  | "matched_property"
  | "existing_tenant"
  | "existing_active_tenancy_skip"
  | "validation_error";

export type PreparedRow = {
  /** Index in the input array — useful for UI diff + progress streams. */
  rowIndex: number;
  raw: BatchOnboardingRow;
  /** Human-readable tags ("new property", "existing tenant"). Can have multiple. */
  tags: PreparedRowStatus[];
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
  if (rows.length === 0) {
    return {
      rows: [],
      summary: {
        total: 0,
        validationErrors: 0,
        newProperties: 0,
        matchedProperties: 0,
        existingTenants: 0,
        skippedActiveTenancies: 0,
        actionableRows: 0,
      },
    };
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

  const emails = Array.from(
    new Set(
      rows
        .map((r) => r.tenantEmail.trim().toLowerCase())
        .filter((e) => e.length > 0),
    ),
  );
  const tenantEmailToId = new Map<string, string>();
  if (emails.length > 0) {
    const { data: tenantRows } = await supabase
      .from("tenants")
      .select("id, email")
      .eq("user_id", userId)
      .in("email", emails);
    for (const t of tenantRows ?? []) {
      const row = t as { id: string; email: string | null };
      if (row.email) tenantEmailToId.set(row.email.toLowerCase(), row.id);
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

  const prepared: PreparedRow[] = rows.map((raw, rowIndex) => {
    if (raw.rowErrors.length > 0) {
      return {
        rowIndex,
        raw,
        tags: ["validation_error"],
        propertyId: null,
        tenantId: null,
        skipReason: null,
      };
    }

    const propKey = normalizeAddr(raw.propertyAddress, raw.city);
    const matchedPropertyId = propKey ? (propertyIndex.get(propKey) ?? null) : null;

    const emailKey = raw.tenantEmail.trim().toLowerCase();
    const matchedTenantId = emailKey ? (tenantEmailToId.get(emailKey) ?? null) : null;

    const tags: PreparedRowStatus[] = [];
    tags.push(matchedPropertyId ? "matched_property" : "new_property");
    if (matchedTenantId) tags.push("existing_tenant");

    let skipReason: string | null = null;
    if (matchedPropertyId && matchedTenantId) {
      const pair = `${matchedPropertyId}:${matchedTenantId}`;
      if (activePairs.has(pair)) {
        tags.push("existing_active_tenancy_skip");
        skipReason = "Active tenancy already exists for this property + tenant";
      }
    }

    return {
      rowIndex,
      raw,
      tags,
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
    actionableRows: prepared.filter(
      (r) =>
        !r.tags.includes("validation_error") &&
        !r.tags.includes("existing_active_tenancy_skip"),
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
        errorsLog.push({ row_index: row.rowIndex, error: outcome.error });

        // Log row-level error (requires manual attention)
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

      if (row.tags.includes("existing_active_tenancy_skip")) {
        outcome.status = "skipped";
        totals.skipped += 1;
        options.onProgress?.(outcome, { ...totals });
        return outcome;
      }

      let propertyId = row.propertyId;
      if (!propertyId) {
        propertyId = crypto.randomUUID();
        const normalizedAddress =
          normalizePropertyAddressLabel(row.raw.propertyAddress) || row.raw.propertyAddress;
        const { error: propErr } = await supabase.from("properties").insert({
          id: propertyId,
          user_id: userId,
          address: normalizedAddress,
          postcode: row.raw.postcode ?? "",
          city: row.raw.city ?? "",
          property_type: "Flat",
          bedrooms: 1,
          bathrooms: 1,
          monthly_rent: row.raw.monthlyRent,
          status: "active",
          has_gas_supply: true,
        });
        if (propErr) throw new Error(`property insert failed: ${propErr.message}`);
        outcome.propertyId = propertyId;
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
      const { error: tenancyErr } = await supabase.from("tenancies").insert({
        id: tenancyId,
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: row.raw.startDate,
        end_date: row.raw.endDate,
        move_in_date: row.raw.moveInDate ?? row.raw.startDate,
        monthly_rent: row.raw.monthlyRent,
        deposit_amount: row.raw.depositAmount ?? row.raw.monthlyRent,
        status: "active",
      });
      if (tenancyErr) throw new Error(`tenancy insert failed: ${tenancyErr.message}`);
      outcome.tenancyId = tenancyId;

      // Trigger Onboarding Agent
      const agentResult = await runTenantOnboardingAgent(tenancyId, userId, supabase);
      outcome.emailStatus = agentResult.emailStatus;
      outcome.status = agentResult.mode === "resume" ? "resumed" : "created";
      totals.succeeded += 1;
      totals.agentsTriggered += 1;

      if (agentResult.emailStatus === "draft") {
        totals.approvalsCreated += 1;
        // Log approval created
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
        // Log meaningful downstream work
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
  const updatePayload: any = {
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
