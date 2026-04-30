"use server";

import { revalidatePath } from "next/cache";

import {
  prepareBatchOnboarding,
  runBatchOnboarding,
  type PreparedRow,
} from "@/lib/onboarding/batch-onboard";
import {
  extractBatchOnboardingRowsWithLlmFromText,
  extractTextFromTenantImportFile,
  parseBatchOnboardingCsv,
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
    actionableRows: number;
  };
};

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

  let rows: BatchOnboardingRow[] = [];
  const csvText = formData.get("csvText");

  if (typeof csvText === "string" && csvText.trim().length > 0) {
    rows = parseBatchOnboardingCsv(csvText);
    if (rows.length === 0) {
      const llm = await extractBatchOnboardingRowsWithLlmFromText(csvText);
      if (!llm.ok) return { ok: false, error: llm.error };
      rows = llm.rows;
    }
  } else {
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return { ok: false, error: "Paste CSV text or upload a file." };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const extracted = await extractTextFromTenantImportFile(buf, file.name, file.type || "");
    if (!extracted.ok) return { ok: false, error: extracted.error };

    const lower = file.name.toLowerCase();
    if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      rows = parseBatchOnboardingCsv(extracted.text);
    }
    if (rows.length === 0) {
      const llm = await extractBatchOnboardingRowsWithLlmFromText(extracted.text);
      if (!llm.ok) return { ok: false, error: llm.error };
      rows = llm.rows;
    }
  }

  if (rows.length === 0) {
    return { ok: false, error: "We couldn't find any rows. Expected columns: property_address, tenant_name, tenant_email, monthly_rent, start_date." };
  }

  const prepared = await prepareBatchOnboarding(rows, user.id, supabase);
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
