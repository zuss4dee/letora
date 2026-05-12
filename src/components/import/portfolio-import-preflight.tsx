"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  reprepareBatchImportRowsAction,
} from "@/lib/actions/batch-onboarding";
import type { PreparedRow } from "@/lib/onboarding/batch-onboard";
import { cn } from "@/lib/utils";

import {
  blockingFixCount,
  computePreflightSummary,
  filterRowsForCommit,
  rowHasWarnings,
  rowNeedsBlockingFix,
  rowNeedsPreflightAttention,
} from "@/components/import/portfolio-import-preflight-model";
import {
  savePortfolioImportDraft,
  type PortfolioImportDraftSummary,
} from "@/components/import/portfolio-import-draft-storage";
import { ExpandableInstructionText } from "@/components/import/expandable-instruction-text";

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  CheckCircle2,
} from "lucide-react";

type RowKindOpt = PreparedRow["raw"]["rowKind"];
type DbStatusOpt = PreparedRow["raw"]["tenancyStatusDb"];

export type PortfolioImportPreflightProps = {
  rows: PreparedRow[];
  summary: PortfolioImportDraftSummary;
  onRowsSummaryChange: (nextRows: PreparedRow[], nextSummary: PortfolioImportDraftSummary) => void;
  excluded: Set<number>;
  onExcludedChange: (next: Set<number>) => void;
  importOnlyClean: boolean;
  onImportOnlyCleanChange: (next: boolean) => void;
  confirmCommit: boolean;
  onConfirmCommitChange: (next: boolean) => void;
  isImportPending: boolean;
  isPreviewing: boolean;
  onImport: () => void;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-mono text-[8px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#555555]">
      {children}
    </span>
  );
}

export function PortfolioImportPreflight(props: PortfolioImportPreflightProps) {
  const {
    rows,
    summary,
    onRowsSummaryChange,
    excluded,
    onExcludedChange,
    importOnlyClean,
    onImportOnlyCleanChange,
    confirmCommit,
    onConfirmCommitChange,
    isImportPending,
    isPreviewing,
    onImport,
  } = props;

  const [listMode, setListMode] = useState<"fix" | "all">("fix");
  const [manifestOpen, setManifestOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [isRepreparing, setIsRepreparing] = useState(false);
  const [reprepareError, setReprepareError] = useState<string | null>(null);

  const reprepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reprepSeqRef = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const excludedRef = useRef(excluded);
  excludedRef.current = excluded;

  const flushReprepare = useCallback(async () => {
    reprepSeqRef.current += 1;
    const seq = reprepSeqRef.current;
    setIsRepreparing(true);
    setReprepareError(null);
    const snapshot = rowsRef.current;
    try {
      const res = await reprepareBatchImportRowsAction(JSON.stringify(snapshot.map((r) => r.raw)));
      if (seq !== reprepSeqRef.current) return;
      if (res.ok === false) {
        setReprepareError(res.error);
        setIsRepreparing(false);
        return;
      }
      onRowsSummaryChange(res.rows, res.summary);
    } catch {
      if (seq !== reprepSeqRef.current) return;
      setReprepareError("Could not re-check rows. Try again in a moment.");
    } finally {
      if (seq === reprepSeqRef.current) setIsRepreparing(false);
    }
  }, [onRowsSummaryChange]);

  const scheduleReprepare = useCallback(() => {
    setReprepareError(null);
    if (reprepTimerRef.current) clearTimeout(reprepTimerRef.current);
    reprepTimerRef.current = setTimeout(() => {
      reprepTimerRef.current = null;
      void flushReprepare();
    }, 450);
  }, [flushReprepare]);

  useEffect(
    () => () => {
      if (reprepTimerRef.current) clearTimeout(reprepTimerRef.current);
    },
    [],
  );

  const cardSummary = useMemo(() => computePreflightSummary(rows), [rows]);

  const importable = useMemo(
    () => filterRowsForCommit(rows, { excluded, onlyNoWarnings: importOnlyClean }),
    [rows, excluded, importOnlyClean],
  );
  const importableCount = importable.length;

  const fixBlocking = useMemo(() => blockingFixCount(rows, excluded), [rows, excluded]);

  const needsAttentionList = useMemo(
    () => rows.filter((r) => !excluded.has(r.rowIndex) && rowNeedsPreflightAttention(r)),
    [rows, excluded],
  );

  const primaryList = useMemo(() => {
    if (listMode === "all") return rows;
    return needsAttentionList.length > 0 ? needsAttentionList : [];
  }, [listMode, rows, needsAttentionList]);

  function patchRaw(rowIndex: number, patch: Partial<PreparedRow["raw"]>) {
    const next = rows.map((r) =>
      r.rowIndex === rowIndex ? { ...r, raw: { ...r.raw, ...patch } } : r,
    );
    onRowsSummaryChange(next, summary);
    scheduleReprepare();
  }

  function toggleExcluded(rowIndex: number) {
    const next = new Set(excluded);
    if (next.has(rowIndex)) next.delete(rowIndex);
    else next.add(rowIndex);
    onExcludedChange(next);
  }

  function scrollPreflightCheckboxStripFallback() {
    document.getElementById("preflight-fix-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** When `Fix N row(s)` is the primary label, targets the first row with normalization / validation blocking issues. */
  const scrollToFirstBlockingRowEditor = useCallback(() => {
    setListMode("fix");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const snapshot = rowsRef.current;
        const exc = excludedRef.current;
        const first = snapshot.find((r) => !exc.has(r.rowIndex) && rowNeedsBlockingFix(r));
        if (first === undefined) {
          scrollPreflightCheckboxStripFallback();
          return;
        }
        const el = document.getElementById(`preflight-row-editor-${first.rowIndex}`);
        if (!el) {
          scrollPreflightCheckboxStripFallback();
          return;
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = el.querySelector<HTMLElement>(
          "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
        );
        focusable?.focus({ preventScroll: true });
      });
    });
  }, []);

  function onSaveLater() {
    savePortfolioImportDraft(rows, summary, {
      excludedRowIndices: excluded.size > 0 ? [...excluded] : undefined,
      importOnlyNoWarnings: importOnlyClean || undefined,
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 4000);
  }

  const navigationalFix = importableCount === 0 && fixBlocking > 0;

  const footerPrimaryDisabled =
    isImportPending ||
    isPreviewing ||
    isRepreparing ||
    (navigationalFix ? fixBlocking === 0 : !confirmCommit || importableCount === 0);

  const primaryIsSolidImport =
    !navigationalFix &&
    confirmCommit &&
    importableCount > 0 &&
    !isImportPending &&
    !isRepreparing &&
    !isPreviewing;

  let primaryLabel: string;
  if (isImportPending && importableCount > 0) primaryLabel = "Importing…";
  else if (importableCount === 0) {
    if (fixBlocking > 0) primaryLabel = `Fix ${fixBlocking} row${fixBlocking === 1 ? "" : "s"}`;
    else primaryLabel = "Nothing to import";
  } else {
    primaryLabel = `Import ${importableCount} ready row${importableCount === 1 ? "" : "s"}`;
  }

  function onFooterPrimaryClick() {
    if (footerPrimaryDisabled) return;
    if (navigationalFix) scrollToFirstBlockingRowEditor();
    else onImport();
  }

  return (
    <section className="border-b border-zinc-200 dark:border-[#282828]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 dark:border-[#282828] bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="bg-white px-1.5 py-0.5 font-mono text-[10px] font-black text-[#161616] dark:bg-zinc-900 dark:text-zinc-100">
            02
          </span>
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Preflight import</h2>
            <p className="mt-0.5 max-w-xl text-[10px] leading-relaxed text-zinc-600 dark:text-[#888888]">
              Nothing is written to your live portfolio until you confirm. Edit rows below, re-check runs automatically, then
              import only what is ready.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setListMode("fix")}
            className={cn(
              "border px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors",
              listMode === "fix"
                ? "border-border dark:border-[#afefdd]/50 bg-background dark:bg-[#152420] text-[#afefdd]"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-[#333333] dark:bg-transparent dark:text-[#888888] dark:hover:text-white",
            )}
          >
            Fix rows
            {needsAttentionList.length > 0 ? (
              <span className="ml-1.5 tabular-nums text-zinc-900 dark:text-white">({needsAttentionList.length})</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setListMode("all")}
            className={cn(
              "border px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors",
              listMode === "all"
                ? "border-border dark:border-[#afefdd]/50 bg-background dark:bg-[#152420] text-[#afefdd]"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-[#333333] dark:bg-transparent dark:text-[#888888] dark:hover:text-white",
            )}
          >
            All rows
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-px bg-zinc-200 dark:bg-[#282828] sm:grid-cols-4">
        {[
          { k: "ready", label: "Ready to import", value: cardSummary.ready, tone: "ok" as const },
          { k: "fix", label: "Needs fixes", value: cardSummary.needsFixes, tone: "err" as const },
          { k: "warn", label: "Warnings", value: cardSummary.warnings, tone: "warn" as const },
          { k: "dup", label: "Possible duplicates", value: cardSummary.duplicates, tone: "muted" as const },
        ].map((c) => (
          <div key={c.k} className="bg-white px-4 py-3 dark:bg-zinc-900">
            <p className="font-mono text-[8px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#555555]">{c.label}</p>
            <p
              className={cn(
                "mt-1 font-mono text-2xl font-semibold tabular-nums",
                c.tone === "ok" && "text-[#afefdd]",
                c.tone === "err" && "text-[#ee7d77]",
                c.tone === "warn" && "text-[#f8cf83]",
                c.tone === "muted" && "text-[#888888]",
              )}
            >
              {c.value.toLocaleString("en-GB")}
            </p>
          </div>
        ))}
      </div>

      {excluded.size > 0 ? (
        <p className="border-b border-zinc-200 dark:border-[#282828] bg-zinc-50 px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-zinc-600 dark:bg-[#161616] dark:text-[#888888]">
          {excluded.size} row{excluded.size === 1 ? "" : "s"} excluded from the next import (still visible in “View all parsed
          rows”).
        </p>
      ) : null}

      {savedFlash ? (
        <div className="flex items-center gap-2 border-b border-border dark:border-[#306f60]/30 bg-background dark:bg-[#152420]/80 px-4 py-2">
          <CheckCircle2 className="size-3.5 text-[#afefdd]" aria-hidden />
          <p className="text-[11px] text-[#c8dfd7]">
            Saved to this browser — you can close the tab and use “Restore prepared import” when you return.
          </p>
        </div>
      ) : null}

      {isRepreparing ? (
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-4 py-2 dark:border-[#333333] dark:bg-zinc-900">
          <Loader2 className="size-3.5 animate-spin text-[#f8cf83]" aria-hidden />
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 dark:text-[#888888]">
            Re-checking edited rows against your portfolio rules…
          </p>
        </div>
      ) : null}

      {reprepareError ? (
        <div className="flex items-start gap-2 border-b border-border dark:border-[#BB5551]/30 bg-background dark:bg-[#7f2927]/12 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#ee7d77]" aria-hidden />
          <span className="text-[11px] text-[#ee7d77]">{reprepareError}</span>
        </div>
      ) : null}

      <div id="preflight-fix-anchor" className="border-b border-zinc-200 dark:border-[#282828] px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={importOnlyClean}
              disabled={isImportPending}
              onChange={(e) => onImportOnlyCleanChange(e.target.checked)}
              className="mt-0.5 size-3.5 shrink-0 rounded border border-zinc-300 bg-white accent-zinc-900 dark:border-[#555555] dark:bg-zinc-900 dark:accent-white"
            />
            <span className="font-mono text-[9px] uppercase tracking-widest leading-relaxed text-zinc-600 dark:text-[#aaaaaa]">
              Import ready rows only — skip any row that still has warnings (yellow notes) in addition to errors and hard skips.
            </span>
          </label>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 dark:text-[#555555]">
            Server pre-check: {summary.actionableRows} actionable · {summary.validationErrors} blocked · {summary.warningRows}{" "}
            with prepare warnings
          </p>
        </div>
      </div>

      {/* Main list */}
      <div className="divide-y divide-zinc-200 dark:divide-[#282828]">
        {listMode === "fix" && needsAttentionList.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[12px] font-medium text-zinc-900 dark:text-white">No rows need attention in this view.</p>
            <p className="mt-2 text-[11px] text-zinc-600 dark:text-[#888888]">
              Switch to “All rows” to review the full set, or continue to import {importableCount > 0 ? `${importableCount} ready row${importableCount === 1 ? "" : "s"}` : "when you have eligible rows"}.
            </p>
          </div>
        ) : (
          primaryList.map((row) => (
            <PreflightRowPanel
              key={row.rowIndex}
              row={row}
              excluded={excluded.has(row.rowIndex)}
              onToggleExclude={() => toggleExcluded(row.rowIndex)}
              onPatch={(patch) => patchRaw(row.rowIndex, patch)}
              disabled={isImportPending}
            />
          ))
        )}
      </div>

      {/* Collapsible full manifest */}
      <div className="border-t border-zinc-200 dark:border-[#282828] bg-zinc-50 dark:bg-[#161616]">
        <button
          type="button"
          onClick={() => setManifestOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-900 dark:text-[#888888] dark:hover:text-white"
          aria-expanded={manifestOpen}
        >
          <span>View all parsed rows ({rows.length})</span>
          {manifestOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {manifestOpen ? (
          <div className="border-t border-zinc-200 dark:border-[#282828]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100 text-[9px] uppercase tracking-widest text-zinc-500 dark:border-[#282828] dark:bg-zinc-900 dark:text-[#555555]">
                    {["#", "Exclude", "Kind", "Property", "Tenant", "Rent", "Start", "End", "State"].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`m-${row.rowIndex}`} className={cn("border-b border-zinc-200 dark:border-[#282828] align-middle", excluded.has(row.rowIndex) ? "opacity-40" : "")}>
                      <td className="px-3 py-2 font-mono text-[10px] tabular-nums text-zinc-500 dark:text-[#555555]">
                        {String(row.rowIndex + 1).padStart(2, "0")}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={excluded.has(row.rowIndex)}
                          disabled={isImportPending}
                          onChange={() => toggleExcluded(row.rowIndex)}
                          aria-label={`Exclude row ${row.rowIndex + 1}`}
                          className="size-3.5 rounded border border-zinc-300 bg-white accent-zinc-900 dark:border-[#555555] dark:bg-zinc-900 dark:accent-white"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] uppercase text-[#888888]">{row.raw.rowKind}</td>
                      <td className="max-w-[200px] px-3 py-2">
                        <p className="truncate text-[11px] text-zinc-900 dark:text-white">{row.raw.propertyAddress || "—"}</p>
                        <p className="truncate font-mono text-[9px] text-zinc-500 dark:text-[#555555]">
                          {[row.raw.propertyDisplayName, row.raw.city, row.raw.postcode].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </td>
                      <td className="max-w-[180px] px-3 py-2">
                        <p className="truncate text-[11px] text-zinc-900 dark:text-white">{row.raw.tenantFullName || "—"}</p>
                        <p className="truncate font-mono text-[9px] text-[#888888]">{row.raw.tenantEmail || "—"}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] tabular-nums text-zinc-900 dark:text-white">
                        {row.raw.monthlyRent > 0 ? `£${row.raw.monthlyRent.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] tabular-nums text-[#888888]">{row.raw.startDate || "—"}</td>
                      <td className="px-3 py-2 font-mono text-[10px] tabular-nums text-[#888888]">{row.raw.endDate || "—"}</td>
                      <td className="px-3 py-2">
                        <ManifestStateCell row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer CTAs */}
      <div className="flex flex-col gap-3 border-t border-zinc-200 dark:border-[#282828] bg-zinc-100 dark:bg-[#1A1A1A] px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-xl flex-col gap-2">
          <label
            className={cn(
              "flex cursor-pointer items-start gap-2 text-left",
              isImportPending && "pointer-events-none opacity-60",
            )}
          >
            <input
              type="checkbox"
              checked={confirmCommit}
              disabled={isImportPending}
              onChange={(e) => onConfirmCommitChange(e.target.checked)}
              className="mt-0.5 size-3.5 shrink-0 rounded border border-zinc-300 bg-white accent-zinc-900 dark:border-[#555555] dark:bg-zinc-900 dark:accent-white"
            />
            <span className="font-mono text-[9px] uppercase tracking-widest leading-relaxed text-zinc-600 dark:text-[#aaaaaa]">
              I confirm — write or match properties, tenants, and tenancies for the selected ready rows. Excluded rows,
              duplicates, validation errors, and active-tenancy skips are not written.
            </span>
          </label>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 dark:text-[#555555]">
            Next batch: {importableCount} row{importableCount === 1 ? "" : "s"} · {excluded.size} excluded ·{" "}
            {importOnlyClean ? "warnings filtered out" : "warnings allowed if row is actionable"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isImportPending || rows.length === 0}
              onClick={onSaveLater}
              className="border border-zinc-200 bg-white px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-40 dark:border-[#333333] dark:bg-zinc-900 dark:text-[#bbbbbb] dark:hover:border-white dark:hover:text-white"
            >
              Save and finish later
            </button>
            <button
              type="button"
              disabled={footerPrimaryDisabled}
              onClick={onFooterPrimaryClick}
              className={cn(
                "flex min-h-[40px] min-w-[12rem] items-center justify-center gap-2 px-6 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-opacity disabled:opacity-40",
                primaryIsSolidImport
                  ? "bg-zinc-100 dark:bg-zinc-900 text-white hover:opacity-90 dark:bg-white dark:text-[#161616]"
                  : "border border-zinc-300 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:border-[#555555] dark:bg-transparent dark:text-white dark:hover:bg-background dark:bg-[#282828]",
              )}
            >
              {isImportPending && importableCount > 0 ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Importing…
                </>
              ) : (
                primaryLabel
              )}
            </button>
          </div>
          {fixBlocking > 0 && importableCount > 0 ? (
            <button
              type="button"
              onClick={() => scrollToFirstBlockingRowEditor()}
              className="font-mono text-[9px] uppercase tracking-widest text-[#f8cf83] underline-offset-4 hover:underline"
            >
              {fixBlocking} row{fixBlocking === 1 ? "" : "s"} still need blocking fixes — jump to first
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ManifestStateCell({ row }: { row: PreparedRow }) {
  if (row.tags.includes("validation_error") || rowNeedsBlockingFix(row)) {
    return <span className="font-mono text-[9px] text-[#ee7d77]">Blocked</span>;
  }
  if (row.tags.includes("duplicate_csv_row_skip")) {
    return <span className="font-mono text-[9px] text-[#888888]">Duplicate</span>;
  }
  if (row.tags.includes("existing_active_tenancy_skip")) {
    return <span className="font-mono text-[9px] text-[#888888]">Active exists</span>;
  }
  if (rowHasWarnings(row)) {
    return <span className="font-mono text-[9px] text-[#f8cf83]">Review</span>;
  }
  return <span className="font-mono text-[9px] text-[#afefdd]">Ready</span>;
}

function reviewPreviewLine(row: PreparedRow): string {
  const fromWarn = row.raw.rowWarnings[0] ?? row.prepareWarnings[0];
  const fromSkip = row.skipReason?.trim();
  const tRaw = (fromWarn ?? fromSkip ?? "").trim();
  if (!tRaw) {
    if (row.tags.includes("duplicate_csv_row_skip")) {
      return "Possible duplicate in this file — expand to review fields or exclude.";
    }
    if (row.tags.includes("existing_active_tenancy_skip")) {
      return "Active tenancy may already exist for this pair — expand or exclude.";
    }
    return "Optional notes on this row — expand when you’re ready.";
  }
  return tRaw;
}

function SeverityLabelBadge({ row }: { row: PreparedRow }) {
  return (
    <span className="inline-flex shrink-0 rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 align-middle dark:border-[#333333] dark:bg-[#1a1a1a]">
      <ManifestStateCell row={row} />
    </span>
  );
}

function PreflightRowPanel({
  row,
  excluded,
  onToggleExclude,
  onPatch,
  disabled,
}: {
  row: PreparedRow;
  excluded: boolean;
  onToggleExclude: () => void;
  onPatch: (patch: Partial<PreparedRow["raw"]>) => void;
  disabled: boolean;
}) {
  const r = row.raw;
  const busy = excluded || disabled;

  const hasBlocking = rowNeedsBlockingFix(row);
  const needsAttention = rowNeedsPreflightAttention(row);
  /** Attention without spreadsheet-level blocking — lighter default UI. */
  const isReviewOnly = needsAttention && !hasBlocking;
  const hasRowWarnings = row.raw.rowWarnings.length > 0;
  const hasPrepareWarnings = row.prepareWarnings.length > 0;
  const hasReviewIssues = hasRowWarnings || hasPrepareWarnings;

  /** Pristine rows in “All rows” stay expanded; blocking always expanded via effect. Review-only defaults collapsed. */
  const defaultDetailOpen = !isReviewOnly;
  const [detailExpanded, setDetailExpanded] = useState(defaultDetailOpen);
  const [editedWhileReviewExpanded, setEditedWhileReviewExpanded] = useState(false);

  useEffect(() => {
    if (hasBlocking) setDetailExpanded(true);
  }, [hasBlocking]);

  const handlePatch = useCallback(
    (patch: Partial<PreparedRow["raw"]>) => {
      setEditedWhileReviewExpanded(true);
      setDetailExpanded(true);
      onPatch(patch);
    },
    [onPatch],
  );

  /** Compact stripe for review-only rows (duplicate / warnings / skips without blocking fixes). */
  if (isReviewOnly && !detailExpanded) {
    return (
      <div
        id={`preflight-row-editor-${row.rowIndex}`}
        className={cn(
          "scroll-mt-6 border-b border-zinc-200/90 bg-zinc-50 px-4 py-2.5 dark:border-[#282828]/80 dark:bg-[#141414]",
          excluded && "opacity-50",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="font-mono text-[9px] tabular-nums uppercase tracking-widest text-[#666666]">
              Row {String(row.rowIndex + 1).padStart(2, "0")}
            </span>
            <SeverityLabelBadge row={row} />
            <div className="min-w-0 max-w-xl flex-1">
              <ExpandableInstructionText
                text={reviewPreviewLine(row)}
                className="text-[10px] leading-snug text-[#9e9e9e]"
                collapsedClampClassName="line-clamp-2"
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setDetailExpanded(true)}
              className="inline-flex items-center gap-1 border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-40 dark:border-[#333333] dark:bg-zinc-900 dark:text-[#cfcfcf] dark:hover:border-border dark:border-[#555555] dark:hover:text-white"
              aria-expanded={false}
            >
              Edit row
              <ChevronRight className="size-3 text-[#888888]" aria-hidden />
            </button>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={excluded}
                disabled={disabled}
                onChange={onToggleExclude}
                className="size-3.5 rounded border border-zinc-300 bg-white accent-zinc-900 dark:border-[#555555] dark:bg-zinc-900 dark:accent-white"
              />
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#777777]">Exclude</span>
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`preflight-row-editor-${row.rowIndex}`}
      className={cn(
        "scroll-mt-6 bg-white px-4 py-4 dark:bg-zinc-900",
        excluded && "opacity-50",
        hasBlocking && !excluded && "ring-1 ring-[#7f2927]/35",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 dark:text-[#555555]">
            Row {String(row.rowIndex + 1).padStart(2, "0")}
          </p>
          <ManifestStateCell row={row} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isReviewOnly && detailExpanded && !editedWhileReviewExpanded ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setDetailExpanded(false)}
              className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#737373] transition-colors hover:text-zinc-900 dark:hover:text-zinc-900 dark:text-white disabled:opacity-40"
            >
              <ChevronUp className="size-3" aria-hidden />
              Hide details
            </button>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={excluded}
              disabled={disabled}
              onChange={onToggleExclude}
              className="size-3.5 rounded border border-zinc-300 bg-white accent-zinc-900 dark:border-[#555555] dark:bg-zinc-900 dark:accent-white"
            />
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#888888]">Exclude from import</span>
          </label>
        </div>
      </div>

      {(hasBlocking || hasReviewIssues) && (
        <div className="mt-4 space-y-3">
          {hasBlocking ? (
            <div className="border border-border dark:border-[#BB5551]/25 bg-background dark:bg-[#7f2927]/12 p-3">
              <p className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#ee7d77]">
                Blocking fixes
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-[#e8b4b0]">
                Must be corrected or excluded before import — these rows will not be written until the issues are cleared.
              </p>
              {row.raw.rowErrors.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-[#ffb3ad]">
                  {row.raw.rowErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : row.tags.includes("validation_error") ? (
                <p className="mt-2 text-[10px] text-[#ffb3ad]">
                  This row is flagged for validation — edit the fields below; the list will refresh after re-check.
                </p>
              ) : null}
            </div>
          ) : null}

          {hasReviewIssues ? (
            <div className="border border-border dark:border-[#4f3700]/35 bg-background dark:bg-[#2a2210]/55 p-3">
              <p className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#f8cf83]">
                Review warnings
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-[#dcc9a3]">
                Can still be imported if you allow warnings — when &ldquo;Import ready rows only&rdquo; is on, rows with
                these notes are skipped.
              </p>
              {hasRowWarnings ? (
                <div className="mt-2">
                  <p className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#a89060]">Spreadsheet</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-[#f8cf83]">
                    {row.raw.rowWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {hasPrepareWarnings ? (
                <div className={cn("mt-2", hasRowWarnings && "border-t border-border dark:border-[#4f3700]/25 pt-2")}>
                  <p className="font-mono text-[8px] font-bold uppercase tracking-widest text-[#a89060]">
                    Portfolio check
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] leading-relaxed text-[#e5d4ae]">
                    {row.prepareWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <FieldLabel>Property display name</FieldLabel>
          <input
            type="text"
            value={r.propertyDisplayName ?? ""}
            disabled={busy}
            onChange={(e) => handlePatch({ propertyDisplayName: e.target.value || null })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <FieldLabel>Property address (street line)</FieldLabel>
          <input
            type="text"
            value={r.propertyAddress}
            disabled={busy}
            onChange={(e) => handlePatch({ propertyAddress: e.target.value })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Postcode</FieldLabel>
          <input
            type="text"
            value={r.postcode ?? ""}
            disabled={busy}
            onChange={(e) => handlePatch({ postcode: e.target.value || null })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>City (optional)</FieldLabel>
          <input
            type="text"
            value={r.city ?? ""}
            disabled={busy}
            onChange={(e) => handlePatch({ city: e.target.value || null })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Row kind</FieldLabel>
          <select
            value={r.rowKind}
            disabled={busy}
            onChange={(e) => handlePatch({ rowKind: e.target.value as RowKindOpt })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          >
            <option value="occupied">Occupied (live tenancy)</option>
            <option value="onboarding">Onboarding (pre move-in)</option>
            <option value="vacant">Vacant (property only)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Tenancy status</FieldLabel>
          <select
            value={r.tenancyStatusDb}
            disabled={busy || r.rowKind === "vacant"}
            onChange={(e) => handlePatch({ tenancyStatusDb: e.target.value as DbStatusOpt })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          >
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="ended">Ended</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Tenant full name</FieldLabel>
          <input
            type="text"
            value={r.tenantFullName}
            disabled={busy || r.rowKind === "vacant"}
            onChange={(e) => handlePatch({ tenantFullName: e.target.value })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Tenant email</FieldLabel>
          <input
            type="email"
            value={r.tenantEmail}
            disabled={busy || r.rowKind === "vacant"}
            onChange={(e) => handlePatch({ tenantEmail: e.target.value })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Tenant phone</FieldLabel>
          <input
            type="text"
            value={r.tenantPhone ?? ""}
            disabled={busy || r.rowKind === "vacant"}
            onChange={(e) => handlePatch({ tenantPhone: e.target.value || null })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Monthly rent (£)</FieldLabel>
          <input
            type="text"
            inputMode="decimal"
            value={r.monthlyRent === 0 ? "" : String(r.monthlyRent)}
            disabled={busy}
            onChange={(e) => {
              const t = e.target.value.trim();
              if (t === "") {
                handlePatch({ monthlyRent: 0 });
                return;
              }
              const n = Number.parseFloat(t.replace(/,/g, ""));
              if (Number.isFinite(n)) handlePatch({ monthlyRent: n });
            }}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Start date</FieldLabel>
          <input
            type="text"
            placeholder="YYYY-MM-DD"
            value={r.startDate}
            disabled={busy || r.rowKind === "vacant"}
            onChange={(e) => handlePatch({ startDate: e.target.value })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>End date (optional)</FieldLabel>
          <input
            type="text"
            placeholder="YYYY-MM-DD"
            value={r.endDate ?? ""}
            disabled={busy || r.rowKind === "vacant"}
            onChange={(e) => handlePatch({ endDate: e.target.value || null })}
            className="w-full border border-zinc-200 dark:border-[#282828] bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none dark:bg-zinc-900 dark:text-white dark:focus:border-white"
          />
        </div>
      </div>
    </div>
  );
}
