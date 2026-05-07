"use server";

import { revalidatePath, unstable_noStore } from "next/cache";

import {
  PortfolioBatchFinalizeError,
  prepareBatchOnboarding,
  runBatchOnboarding,
  type PreparedRow,
} from "@/lib/onboarding/batch-onboard";
import {
  decidePortfolioCsvParse,
  extractBatchOnboardingRowsWithLlmFromText,
  extractTextFromTenantImportFile,
  type BatchOnboardingRow,
} from "@/lib/onboarding/tenant-import";
import { createClient } from "@/lib/supabase/server";
import { FREE_WORKSPACE_PROPERTY_CAP, getMaxPropertiesForUser } from "@/lib/plan-limits";

export type BatchImportHistoryRow = {
  id: string;
  kind: string;
  status: string;
  rowsTotal: number;
  rowsSucceeded: number;
  rowsFailed: number;
  agentsTriggered: number;
  approvalsCreated: number;
  createdAt: string | null;
  completedAt: string | null;
};

export type PreparePayload = {
  ok: true;
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

function isStructuredPortfolioFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")
  );
}

/**
 * Parse pasted or extracted text: strict CSV/TSV for structured uploads; LLM fallback for PDF/DOCX-style text.
 */
async function loadBatchOnboardingRowsFromText(
  text: string,
  structuredInput: boolean,
): Promise<{ ok: true; rows: BatchOnboardingRow[] } | { ok: false; error: string }> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: structuredInput ? "File or paste is empty." : "No text to read from this file." };
  }

  const decision = decidePortfolioCsvParse(trimmed, structuredInput);

  if (decision.kind === "structured_fail") {
    return { ok: false, error: decision.error };
  }

  if (decision.kind === "ready") {
    return { ok: true, rows: decision.rows };
  }

  const llm = await extractBatchOnboardingRowsWithLlmFromText(text);
  if (!llm.ok) {
    const hint = structuredInput ? "" : " If this is meant to be CSV, export as .csv with a header row.";
    return { ok: false, error: `${llm.error}${hint}` };
  }
  return { ok: true, rows: llm.rows };
}

/**
 * Parse a CSV text or an uploaded file into BatchOnboardingRow[] and classify each row.
 * Pass either `csvText` or a `file` in the FormData — not both.
 */
export async function previewBatchOnboardingFromFormData(
  formData: FormData,
): Promise<PreparePayload | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  let load: { ok: true; rows: BatchOnboardingRow[] } | { ok: false; error: string };
  const csvText = formData.get("csvText");

  if (typeof csvText === "string" && csvText.trim().length > 0) {
    load = await loadBatchOnboardingRowsFromText(csvText, true);
  } else {
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return { ok: false, error: "Paste CSV text or upload a file." };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const extracted = await extractTextFromTenantImportFile(buf, file.name, file.type || "");
    if (!extracted.ok) return { ok: false, error: extracted.error };

    const structured = isStructuredPortfolioFilename(file.name);
    load = await loadBatchOnboardingRowsFromText(extracted.text, structured);
  }

  if (!load.ok) return load;
  if (load.rows.length === 0) {
    return {
      ok: false,
      error:
        "No import rows were produced. Add at least one row with property_address (and tenant columns for occupied/onboarding rows), or use row_kind with vacant for property-only lines.",
    };
  }

  const prepared = await prepareBatchOnboarding(load.rows, user.id, supabase);
  return { ok: true, rows: prepared.rows, summary: prepared.summary };
}

/**
 * Executes a preview set (already classified) against the DB.
 * Rows are expected to be a JSON-serialised PreparedRow[] — the client
 * passes back whatever the preview returned (plus any in-place edits).
 */
export async function startBatchOnboardingAction(
  rowsJson: string,
): Promise<
  | {
      ok: true;
      batchId: string;
      totals: {
        total: number;
        succeeded: number;
        failed: number;
        skipped: number;
        agentsTriggered: number;
        approvalsCreated: number;
      };
    }
  | { ok: false; error: string; reason?: "plan_limit"; batchId?: string; finalizeFailed?: true }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  let preparedRows: PreparedRow[];
  try {
    const parsed = JSON.parse(rowsJson) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Expected an array of rows");
    preparedRows = parsed as PreparedRow[];
  } catch {
    return { ok: false, error: "Could not read the preview rows." };
  }

  const badPayload = preparedRows.some(
    (r) =>
      !r ||
      typeof r !== "object" ||
      !("raw" in r) ||
      !r.raw ||
      typeof r.raw !== "object" ||
      typeof (r.raw as BatchOnboardingRow).rowKind !== "string",
  );
  if (badPayload) {
    return {
      ok: false,
      error: "Stale or invalid preview data. Click Preview Rows again, then confirm import.",
    };
  }

  const normalisedRows: BatchOnboardingRow[] = preparedRows.map((r) => r.raw);
  const reprepared = await prepareBatchOnboarding(normalisedRows, user.id, supabase);

  const newPropertyCount = reprepared.summary.newProperties;
  if (newPropertyCount > 0) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("subscription_plan, subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();
    const maxProps = getMaxPropertiesForUser({
      subscription_plan: settings?.subscription_plan ?? null,
      subscription_status: settings?.subscription_status ?? null,
    });
    if (maxProps !== -1) {
      const { count } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      const currentCount = count ?? 0;
      if (currentCount + newPropertyCount > maxProps) {
        const remaining = Math.max(0, maxProps - currentCount);
        return {
          ok: false,
          reason: "plan_limit",
          error: `This batch would create ${newPropertyCount} new properties, but your free workspace can only fit ${remaining} more (cap ${FREE_WORKSPACE_PROPERTY_CAP}). Subscribe for unlimited imports, review options in Billing, or reduce new-property rows.`,
        };
      }
    }
  }

  try {
    const result = await runBatchOnboarding(reprepared, user.id, supabase);

    revalidatePath("/dashboard/import");
    revalidatePath(`/dashboard/import/batch/${result.batchId}`);
    revalidatePath("/dashboard/tenants");
    revalidatePath("/dashboard/tenancies");
    revalidatePath("/dashboard/properties");
    revalidatePath("/dashboard/rent-tracker");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/activity");

    return {
      ok: true,
      batchId: result.batchId,
      totals: result.totals,
    };
  } catch (err) {
    if (err instanceof PortfolioBatchFinalizeError) {
      revalidatePath(`/dashboard/import/batch/${err.batchId}`);
      return {
        ok: false,
        error: `${err.message} Open the batch page after refreshing — finalize could not persist the summary row.`,
        batchId: err.batchId,
        finalizeFailed: true,
      };
    }
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Import stopped unexpectedly.";
    return {
      ok: false,
      error: `Could not finish import (${msg}). If this persists, run Preview Rows again.`,
    };
  }
}

/** Per-row snapshot for the batch result UI (avoid importing onboarding types into the Turbopack action graph). */
export type BatchImportDetailRow = {
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

export type BatchImportDetail = {
  id: string;
  kind: string;
  status: string;
  rowsTotal: number;
  rowsSucceeded: number;
  rowsFailed: number;
  agentsTriggered: number;
  approvalsCreated: number;
  createdAt: string | null;
  completedAt: string | null;
  finalizeError?: string | null;
  rows: BatchImportDetailRow[];
};

function coerceOutcomesPayload(raw: unknown): BatchImportDetailRow[] {
  if (!Array.isArray(raw)) return [];
  const out: BatchImportDetailRow[] = [];
  const asStrArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : [];

  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const rowIndex = typeof o.rowIndex === "number" ? o.rowIndex : Number(o.rowIndex);
    if (!Number.isFinite(rowIndex)) continue;

    out.push({
      rowIndex,
      line: typeof o.line === "number" && Number.isFinite(o.line) ? o.line : rowIndex + 1,
      rowKind: typeof o.rowKind === "string" ? o.rowKind : "occupied",
      propertyAddress: typeof o.propertyAddress === "string" ? o.propertyAddress : "",
      tenantFullName: typeof o.tenantFullName === "string" ? o.tenantFullName : "",
      tenantEmail: typeof o.tenantEmail === "string" ? o.tenantEmail : "",
      tags: asStrArr(o.tags),
      previewErrors: asStrArr(o.previewErrors),
      previewWarnings: asStrArr(o.previewWarnings),
      prepareWarnings: asStrArr(o.prepareWarnings),
      skipReason: typeof o.skipReason === "string" ? o.skipReason : null,
      outcome: typeof o.outcome === "string" ? o.outcome : "skipped",
      runtimeError: typeof o.runtimeError === "string" ? o.runtimeError : undefined,
      propertyId: typeof o.propertyId === "string" ? o.propertyId : null,
      tenantId: typeof o.tenantId === "string" ? o.tenantId : null,
      tenancyId: typeof o.tenancyId === "string" ? o.tenancyId : null,
      emailStatus: typeof o.emailStatus === "string" ? o.emailStatus : null,
    });
  }
  return out.sort((a, b) => a.rowIndex - b.rowIndex);
}

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/**
 * Load one batch_imports row plus per-row snapshot for the result screen.
 */
export async function getBatchImportById(
  batchId: string,
): Promise<{ ok: false; error: string } | { ok: true; batch: BatchImportDetail }> {
  unstable_noStore();

  const id = typeof batchId === "string" ? batchId.trim() : "";
  if (!UUID_RE.test(id)) return { ok: false, error: "Invalid batch id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const selectMetricsOutcomesFinalize =
    "id, kind, status, rows_total, rows_succeeded, rows_failed, agents_triggered, approvals_created, errors_json, outcomes_json, created_at, completed_at, finalize_error";

  const selectMetricsOutcomes =
    "id, kind, status, rows_total, rows_succeeded, rows_failed, agents_triggered, approvals_created, errors_json, outcomes_json, created_at, completed_at";

  let { data, error } = await supabase
    .from("batch_imports")
    .select(selectMetricsOutcomesFinalize)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error?.code === "42703") {
    const r = await supabase
      .from("batch_imports")
      .select(selectMetricsOutcomes)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    data = r.data as typeof data;
    error = r.error;
  }

  if (error?.code === "42703") {
    const fb = await supabase
      .from("batch_imports")
      .select(
        "id, kind, status, rows_total, rows_succeeded, rows_failed, agents_triggered, approvals_created, errors_json, created_at, completed_at",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    data = fb.data as typeof data;
    error = fb.error;
  }

  if (error) {
    console.error("[batch_import][page_read]", {
      batchId: id,
      outcome: "select_error",
      message: error.message,
      code: error.code,
    });
    return { ok: false, error: "Could not load batch." };
  }
  if (!data) return { ok: false, error: "Batch not found." };

  const row = data as Record<string, unknown>;
  const outcomesSource =
    typeof row.outcomes_json !== "undefined" && row.outcomes_json !== null
      ? row.outcomes_json
      : undefined;

  let rows = coerceOutcomesPayload(outcomesSource);

  /* Older batches: minimal rows when outcomes_json absent */
  if (rows.length === 0) {
    const total = Number(row.rows_total ?? 0);
    if (total > 0) {
      const errRows = Array.isArray(row.errors_json)
        ? (row.errors_json as Array<{ row_index?: number; error?: string }>)
        : [];
      const errByIdx = new Map<number, string>();
      for (const e of errRows) {
        if (typeof e.row_index === "number" && typeof e.error === "string") errByIdx.set(e.row_index, e.error);
      }
      rows = Array.from({ length: total }, (_, i) => ({
        rowIndex: i,
        line: i + 1,
        rowKind: "—",
        propertyAddress: "—",
        tenantFullName: "",
        tenantEmail: "",
        tags: [] as string[],
        previewErrors: [] as string[],
        previewWarnings: [] as string[],
        prepareWarnings: [] as string[],
        skipReason: null as string | null,
        outcome: errByIdx.has(i) ? "error" : ("skipped" as string),
        runtimeError: errByIdx.get(i),
        propertyId: null as string | null,
        tenantId: null as string | null,
        tenancyId: null as string | null,
        emailStatus: null as string | null,
      }));
    }
  }

  const batch: BatchImportDetail = {
    id: String(row.id ?? id),
    kind: String(row.kind ?? ""),
    status: String(row.status ?? ""),
    rowsTotal: Number(row.rows_total ?? 0),
    rowsSucceeded: Number(row.rows_succeeded ?? 0),
    rowsFailed: Number(row.rows_failed ?? 0),
    agentsTriggered: Number(row.agents_triggered ?? 0),
    approvalsCreated: Number(row.approvals_created ?? 0),
    createdAt: (row.created_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    finalizeError: typeof row.finalize_error === "string" ? row.finalize_error : null,
    rows,
  };

  console.info("[batch_import][page_read]", {
    batchId: batch.id,
    status: batch.status,
    completedAt: batch.completedAt,
    finalizeErrorRecorded: Boolean(batch.finalizeError),
    rowsSnapshotted: batch.rows.length,
  });

  return { ok: true, batch };
}

/** Recent batches for the landlord — used on the import page history panel. */
export async function getBatchImportsForUser(userId: string): Promise<BatchImportHistoryRow[]> {
  const supabase = await createClient();

  // Resilience: Try with agentic metrics first, fallback if migration hasn't run
  const { data, error } = await supabase
    .from("batch_imports")
    .select(
      "id, kind, status, rows_total, rows_succeeded, rows_failed, agents_triggered, approvals_created, created_at, completed_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    // 42703 = column does not exist (Postgres)
    if (error.code === "42703") {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from("batch_imports")
        .select("id, kind, status, rows_total, rows_succeeded, rows_failed, created_at, completed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (fallbackErr) {
        console.error("[getBatchImportsForUser:fallback]", fallbackErr.message);
        return [];
      }

      return (fallbackData ?? []).map((r) => ({
        id: String(r.id),
        kind: String(r.kind),
        status: String(r.status),
        rowsTotal: Number(r.rows_total ?? 0),
        rowsSucceeded: Number(r.rows_succeeded ?? 0),
        rowsFailed: Number(r.rows_failed ?? 0),
        agentsTriggered: 0,
        approvalsCreated: 0,
        createdAt: (r.created_at as string | null) ?? null,
        completedAt: (r.completed_at as string | null) ?? null,
      }));
    }

    console.error("[getBatchImportsForUser]", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    status: String(r.status),
    rowsTotal: Number(r.rows_total ?? 0),
    rowsSucceeded: Number(r.rows_succeeded ?? 0),
    rowsFailed: Number(r.rows_failed ?? 0),
    agentsTriggered: Number((r as any).agents_triggered ?? 0),
    approvalsCreated: Number((r as any).approvals_created ?? 0),
    createdAt: (r.created_at as string | null) ?? null,
    completedAt: (r.completed_at as string | null) ?? null,
  }));
}
