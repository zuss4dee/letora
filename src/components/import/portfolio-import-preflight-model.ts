import type { PreparedRow } from "@/lib/onboarding/batch-onboard";

/** Rows Letora would attempt during import (excluding hard skips baked into tags). */
export function isPreparedRowActionable(row: PreparedRow): boolean {
  return (
    !row.tags.includes("validation_error") &&
    !row.tags.includes("existing_active_tenancy_skip") &&
    !row.tags.includes("duplicate_csv_row_skip")
  );
}

/** Blocking spreadsheet / normalization issues. */
export function rowNeedsBlockingFix(row: PreparedRow): boolean {
  return row.tags.includes("validation_error") || row.raw.rowErrors.length > 0;
}

/** Non-blocking messages — import may still proceed. */
export function rowHasWarnings(row: PreparedRow): boolean {
  return row.raw.rowWarnings.length > 0 || row.prepareWarnings.length > 0;
}

/** Preflight UX: duplicates in-file. */
export function rowIsPossibleDuplicate(row: PreparedRow): boolean {
  return row.tags.includes("duplicate_csv_row_skip");
}

/** Completely clean actionable row — safe “green lane”. */
export function isPristineReadyRow(row: PreparedRow): boolean {
  return isPreparedRowActionable(row) && !rowNeedsBlockingFix(row) && !rowHasWarnings(row);
}

export type PreflightSummaryCards = {
  ready: number;
  needsFixes: number;
  warnings: number;
  duplicates: number;
  total: number;
};

export function computePreflightSummary(rows: PreparedRow[]): PreflightSummaryCards {
  let ready = 0;
  let needsFixes = 0;
  let warnings = 0;
  let duplicates = 0;
  for (const row of rows) {
    if (rowIsPossibleDuplicate(row)) {
      duplicates += 1;
      continue;
    }
    if (rowNeedsBlockingFix(row)) {
      needsFixes += 1;
      continue;
    }
    if (rowHasWarnings(row)) {
      warnings += 1;
      continue;
    }
    if (isPreparedRowActionable(row)) ready += 1;
  }
  return { ready, needsFixes, warnings, duplicates, total: rows.length };
}

export function rowNeedsPreflightAttention(row: PreparedRow): boolean {
  if (rowIsPossibleDuplicate(row)) return true;
  if (rowNeedsBlockingFix(row)) return true;
  if (rowHasWarnings(row)) return true;
  if (row.tags.includes("existing_active_tenancy_skip")) return true;
  return false;
}

export type ImportEligibleOptions = {
  excluded: Set<number>;
  onlyNoWarnings: boolean;
};

/** Rows that would be POSTed as PreparedRow[]. */
export function filterRowsForCommit(
  rows: PreparedRow[],
  opts: ImportEligibleOptions,
): PreparedRow[] {
  return rows.filter((r) => {
    if (opts.excluded.has(r.rowIndex)) return false;
    if (!isPreparedRowActionable(r)) return false;
    if (opts.onlyNoWarnings && rowHasWarnings(r)) return false;
    return true;
  });
}

export function blockingFixCount(
  rows: PreparedRow[],
  excluded: Set<number>,
): number {
  return rows.filter((r) => !excluded.has(r.rowIndex) && rowNeedsBlockingFix(r)).length;
}
