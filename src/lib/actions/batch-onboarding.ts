"use server";

import { revalidatePath } from "next/cache";

import {
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
import { getMaxPropertiesForUser } from "@/lib/plan-limits";

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
  | { ok: false; error: string }
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
        return {
          ok: false,
          error: `This batch would create ${newPropertyCount} new properties, but your plan allows ${maxProps - currentCount} more. Upgrade on the Pricing page or reduce the batch.`,
        };
      }
    }
  }

  const result = await runBatchOnboarding(reprepared, user.id, supabase);

  revalidatePath("/dashboard/import");
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
