"use client";

import type { BatchImportDetailRow } from "@/lib/actions/batch-onboarding";
import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import {
  loadDismissedReviewLines,
  mergeDismissedWithQueue,
  saveDismissedReviewLines,
} from "@/lib/import/batch-reviewed-lines-storage";
import type { BatchReconciliationModel, SuspiciousFlag } from "@/lib/onboarding/batch-import-reconciliation";
import {
  humanRecordLabel,
  primaryAttentionReason,
  recordDashboardLinks,
} from "@/lib/onboarding/batch-import-attention-guidance";
import { rowKindNorm } from "@/lib/onboarding/batch-import-reconciliation";
import { priorityLabel } from "@/lib/onboarding/batch-import-review-priority";
import {
  buildBatchReviewReturnHref,
  reviewRowDomId,
  withReturnToQuery,
} from "@/lib/navigation/batch-review-return";
import { ExpandableInstructionText } from "@/components/import/expandable-instruction-text";
import { cn } from "@/lib/utils";

/** Survives Browser Back when the URL hash is missing after client navigation. */
function reviewLineStorageKey(batchId: string): string {
  return `letora:importBatchReviewLine:${batchId}`;
}

function readStoredReviewLine(batchId: string, queue: BatchReconciliationModel["needsReviewQueue"]): number | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(reviewLineStorageKey(batchId));
    if (raw == null) return null;
    const line = Number(raw);
    if (!Number.isFinite(line)) return null;
    if (!queue.some(({ row }) => row.line === line)) return null;
    return line;
  } catch {
    return null;
  }
}

function persistStoredReviewLine(batchId: string, line: number): void {
  try {
    sessionStorage.setItem(reviewLineStorageKey(batchId), String(line));
  } catch {
    /* quota / private mode */
  }
}

function clearStoredReviewLine(batchId: string): void {
  try {
    sessionStorage.removeItem(reviewLineStorageKey(batchId));
  } catch {
    /* quota / private mode */
  }
}

function lineFromHash(queue: BatchReconciliationModel["needsReviewQueue"]): number | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  if (!hash.startsWith("review-row-")) return null;
  const line = Number(hash.slice("review-row-".length));
  if (!Number.isFinite(line)) return null;
  if (!queue.some(({ row }) => row.line === line)) return null;
  return line;
}

type ReviewQueueEntry = BatchReconciliationModel["needsReviewQueue"][number];

const reviewedTaskButtonClass =
  "inline-flex shrink-0 border border-zinc-600 bg-zinc-900 px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-300 hover:border-[#afefdd]/40 hover:text-[#afefdd]";

function ReviewQueueRow({
  batchId,
  entry,
  focused,
  onActivateRow,
  onMarkReviewed,
  detailsOpen,
  onToggleDetails,
}: {
  batchId: string;
  entry: ReviewQueueEntry;
  focused: boolean;
  onActivateRow: () => void;
  onMarkReviewed: () => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}) {
  const { row, priority } = entry;
  const triage = priorityLabel(priority);
  const reason = primaryAttentionReason(row);
  const raw = recordDashboardLinks(row);
  const returnHref = buildBatchReviewReturnHref(batchId, row.line);

  type OpenLink = { label: string; href: string };
  const opens: OpenLink[] = [];
  if (raw.tenancy) opens.push({ label: "Open tenancy", href: withReturnToQuery(raw.tenancy, returnHref) });
  if (raw.tenant) opens.push({ label: "Open tenant", href: withReturnToQuery(raw.tenant, returnHref) });
  if (raw.property) opens.push({ label: "Open property", href: withReturnToQuery(raw.property, returnHref) });

  const [primaryOpen, ...secondaryOpens] = opens;
  const primaryClass =
    "inline-flex border border-[#306f60]/50 bg-[#152420]/90 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#afefdd] hover:border-[#afefdd]/50";
  const secondaryClass =
    "inline-flex border border-[#333333] bg-[#161616] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-200 hover:border-white";
  const rowId = reviewRowDomId(row.line);

  if (!focused) {
    return (
      <div
        id={rowId}
        className="scroll-mt-28 flex w-full items-stretch gap-2 border-b border-[#282828] px-2 py-2 last:border-b-0 sm:items-start sm:gap-3 sm:px-3 sm:py-2.5"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <button
            type="button"
            className="flex w-full items-start gap-2 text-left hover:bg-[#1A1A1A]/80 sm:gap-3"
            onClick={onActivateRow}
          >
            <span className="font-mono text-[10px] tabular-nums text-zinc-500">{row.line}</span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-sm font-medium text-zinc-300">{humanRecordLabel(row)}</p>
            </div>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-zinc-600" aria-hidden />
          </button>
          <div className="min-w-0 pl-9 sm:pl-10">
            <ExpandableInstructionText
              text={reason}
              className="text-[11px] leading-snug text-zinc-500"
              collapsedClampClassName="line-clamp-2"
            />
          </div>
        </div>
        <button type="button" className={reviewedTaskButtonClass} onClick={onMarkReviewed}>
          Reviewed
        </button>
      </div>
    );
  }

  return (
    <div
      id={rowId}
      className="scroll-mt-28 border-b border-[#282828] border-l-2 border-l-[#f8cf83]/60 bg-[#161616]/95 last:border-b-0"
    >
      <div className="space-y-3 px-3 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-[11px] tabular-nums text-zinc-400">{row.line}</span>
          <p className="min-w-0 flex-1 text-sm font-medium text-white">{humanRecordLabel(row)}</p>
        </div>
        <ExpandableInstructionText
          text={reason}
          className="text-[12px] leading-snug text-zinc-400"
          collapsedClampClassName="line-clamp-3"
        />
        <div className="flex flex-wrap gap-2">
          {primaryOpen ? (
            <Link href={primaryOpen.href} className={primaryClass}>
              {primaryOpen.label}
            </Link>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">No linked record.</span>
          )}
          {secondaryOpens.map((o) => (
            <Link key={o.label} href={o.href} className={secondaryClass}>
              {o.label}
            </Link>
          ))}
          <button type="button" className={reviewedTaskButtonClass} onClick={onMarkReviewed}>
            Reviewed
          </button>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 border border-[#282828] bg-[#0d0d0d]/80 px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          aria-expanded={detailsOpen}
          onClick={onToggleDetails}
        >
          Technical
          <ChevronDown className={cn("size-3.5 shrink-0 text-zinc-500 transition-transform", detailsOpen && "rotate-180")} />
        </button>
        {detailsOpen ? (
          <div className="space-y-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
              Tag ·{" "}
              <span className={cn("inline-flex border px-1.5 py-0.5", triage.className)}>{triage.label}</span>
            </span>
            <RowDetailsBody r={row} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReviewQueueSection({
  batchId,
  queue,
  onMarkReviewed,
}: {
  batchId: string;
  queue: BatchReconciliationModel["needsReviewQueue"];
  onMarkReviewed: (line: number) => void;
}) {
  const pathname = usePathname() ?? "";
  const queueKey = useMemo(() => queue.map(({ row }) => row.line).join(","), [queue]);

  const [focusedLine, setFocusedLine] = useState<number | null>(null);
  const [detailsLines, setDetailsLines] = useState<Set<number>>(() => new Set());

  const scrollToLine = useCallback((line: number) => {
    requestAnimationFrame(() => {
      document.getElementById(reviewRowDomId(line))?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const applyFocusFromLocation = useCallback(() => {
    if (queue.length === 0) {
      setFocusedLine(null);
      return;
    }

    const fromHash = lineFromHash(queue);
    if (fromHash != null) {
      setFocusedLine(fromHash);
      persistStoredReviewLine(batchId, fromHash);
      scrollToLine(fromHash);
      return;
    }

    const fromStore = readStoredReviewLine(batchId, queue);
    if (fromStore != null) {
      setFocusedLine(fromStore);
      window.history.replaceState(null, "", `${pathname}#${reviewRowDomId(fromStore)}`);
      persistStoredReviewLine(batchId, fromStore);
      scrollToLine(fromStore);
      return;
    }

    const pick = queue[0]!.row.line;
    setFocusedLine(pick);
    persistStoredReviewLine(batchId, pick);
    window.history.replaceState(null, "", `${pathname}#${reviewRowDomId(pick)}`);
    scrollToLine(pick);
  }, [batchId, pathname, queue, scrollToLine]);

  useEffect(() => {
    if (queue.length === 0) {
      setFocusedLine(null);
      setDetailsLines(new Set());
      clearStoredReviewLine(batchId);
      const base = pathname.split("#")[0] ?? pathname;
      if (base) window.history.replaceState(null, "", base);
      return;
    }
    if (focusedLine != null && !queue.some(({ row }) => row.line === focusedLine)) {
      const pick = queue[0]!.row.line;
      setFocusedLine(pick);
      setDetailsLines(new Set());
      persistStoredReviewLine(batchId, pick);
      window.history.replaceState(null, "", `${pathname}#${reviewRowDomId(pick)}`);
      scrollToLine(pick);
    }
  }, [batchId, focusedLine, pathname, queue, queueKey, scrollToLine]);

  useEffect(() => {
    applyFocusFromLocation();
    const onNav = () => applyFocusFromLocation();
    window.addEventListener("hashchange", onNav);
    window.addEventListener("popstate", onNav);
    const onPageShow = () => applyFocusFromLocation();
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("hashchange", onNav);
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [batchId, queueKey, applyFocusFromLocation]);

  const focusLine = useCallback(
    (line: number) => {
      setDetailsLines(new Set());
      setFocusedLine(line);
      persistStoredReviewLine(batchId, line);
      window.history.replaceState(null, "", `${pathname}#${reviewRowDomId(line)}`);
      scrollToLine(line);
    },
    [batchId, pathname, scrollToLine],
  );

  const currentIndex =
    focusedLine == null ? -1 : queue.findIndex(({ row }) => row.line === focusedLine);
  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;

  const goPrevInQueue = useCallback(() => {
    if (effectiveIndex <= 0) return;
    focusLine(queue[effectiveIndex - 1]!.row.line);
  }, [effectiveIndex, focusLine, queue]);

  const goNextInQueue = useCallback(() => {
    if (effectiveIndex >= queue.length - 1) return;
    focusLine(queue[effectiveIndex + 1]!.row.line);
  }, [effectiveIndex, focusLine, queue]);

  const toggleDetailsForLine = useCallback(
    (line: number) => {
      setFocusedLine(line);
      persistStoredReviewLine(batchId, line);
      window.history.replaceState(null, "", `${pathname}#${reviewRowDomId(line)}`);
      setDetailsLines((prev) => {
        if (prev.has(line)) return new Set();
        return new Set([line]);
      });
    },
    [batchId, pathname],
  );

  if (queue.length === 0) {
    return <p className="px-3 py-6 text-center text-sm text-zinc-500">Nothing left to check here.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#282828] bg-[#141414] px-3 py-2 font-mono text-[10px] uppercase tracking-widest">
        <button
          type="button"
          onClick={goPrevInQueue}
          disabled={effectiveIndex <= 0}
          className={cn(
            "rounded-sm border px-2 py-1.5 text-zinc-300 disabled:pointer-events-none disabled:opacity-30",
            effectiveIndex > 0
              ? "border-zinc-600 hover:border-[#f8cf83]/50 hover:text-[#f8cf83]"
              : "border-zinc-800 text-zinc-600",
          )}
        >
          Previous
        </button>
        <span className="text-zinc-500">
          <span className="text-zinc-300">{effectiveIndex + 1}</span> / {queue.length}
        </span>
        <button
          type="button"
          onClick={goNextInQueue}
          disabled={effectiveIndex >= queue.length - 1}
          className={cn(
            "rounded-sm border px-2 py-1.5 text-zinc-300 disabled:pointer-events-none disabled:opacity-30",
            effectiveIndex < queue.length - 1
              ? "border-zinc-600 hover:border-[#f8cf83]/50 hover:text-[#f8cf83]"
              : "border-zinc-800 text-zinc-600",
          )}
        >
          Next
        </button>
      </div>

      {queue.map((entry) => {
        const line = entry.row.line;
        const focused = focusedLine === line;
        return (
          <ReviewQueueRow
            key={entry.row.rowIndex}
            batchId={batchId}
            entry={entry}
            focused={focused}
            onActivateRow={() => focusLine(line)}
            onMarkReviewed={() => onMarkReviewed(line)}
            detailsOpen={focused && detailsLines.has(line)}
            onToggleDetails={() => toggleDetailsForLine(line)}
          />
        );
      })}
    </div>
  );
}

function ReviewedQueueCollapsible({ entries }: { entries: ReviewQueueEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <details className="group border-t border-[#282828] bg-[#141414]">
      <summary className="cursor-pointer list-none px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500 marker:content-none hover:bg-[#1A1A1A]/60 [&::-webkit-details-marker]:hidden">
        Reviewed ({entries.length})
      </summary>
      <ul className="divide-y divide-[#282828]">
        {entries.map(({ row }) => (
          <li key={row.rowIndex} className="px-3 py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-[10px] tabular-nums text-zinc-600">{row.line}</span>
              <p className="min-w-0 flex-1 text-sm text-zinc-400">{humanRecordLabel(row)}</p>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

const batchCompletedFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Europe/London",
});

function outcomeBadge(outcome: string): { label: string; className: string } {
  switch (outcome) {
    case "created":
    case "resumed":
      return { label: "Saved", className: "border-[#306f60]/40 bg-[#206153]/20 text-[#afefdd]" };
    case "skipped":
      return { label: "Skipped", className: "border-zinc-600/50 bg-zinc-900/60 text-zinc-400" };
    case "error":
      return { label: "Failed", className: "border-[#BB5551]/40 bg-[#7f2927]/15 text-[#ee7d77]" };
    default:
      return { label: outcome, className: "border-zinc-600/50 bg-zinc-900/60 text-zinc-400" };
  }
}

function CompactRowPreview({ r }: { r: BatchImportDetailRow }) {
  const o = outcomeBadge(r.outcome);
  const rk = rowKindNorm(r);
  const hint =
    r.previewErrors.length > 0
      ? "Validation issue"
      : r.previewWarnings.length > 0 || r.prepareWarnings.length > 0
        ? "Needs a quick look"
        : r.runtimeError
          ? "Runtime issue"
          : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest",
          o.className,
        )}
      >
        {o.label}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">{rk || "—"}</span>
      {r.emailStatus ? (
        <span className="font-mono text-[9px] text-zinc-500">Email: {r.emailStatus}</span>
      ) : null}
      {hint ? (
        <span className="rounded-sm border border-[#f8cf83]/25 bg-[#2a2210]/80 px-1.5 py-0.5 font-mono text-[9px] text-[#f8cf83]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function RowDetailsBody({ r }: { r: BatchImportDetailRow }) {
  return (
    <div className="space-y-2 border-t border-[#282828] bg-[#0d0d0d] px-3 py-3 font-mono text-[10px] leading-relaxed text-zinc-400">
      <p>
        <span className="text-zinc-500">Line {r.line}</span> ·{" "}
        <span className="text-zinc-300">{r.propertyAddress || "—"}</span>
      </p>
      {r.tenantFullName || r.tenantEmail ? (
        <p className="text-zinc-300">
          {r.tenantFullName || "—"}
          {r.tenantEmail ? ` · ${r.tenantEmail}` : ""}
        </p>
      ) : null}
      {r.previewErrors.length > 0 ? (
        <p className="text-[#ee7d77]">Errors: {r.previewErrors.join("; ")}</p>
      ) : null}
      {r.previewWarnings.length > 0 ? (
        <p className="text-[#f8cf83]">Warnings: {r.previewWarnings.join("; ")}</p>
      ) : null}
      {r.prepareWarnings.length > 0 ? (
        <p className="text-[#f8cf83]">Prep: {r.prepareWarnings.join("; ")}</p>
      ) : null}
      {r.runtimeError ? <p className="text-[#ee7d77]">Runtime: {r.runtimeError}</p> : null}
      {r.skipReason ? <p className="text-zinc-500">Skip: {r.skipReason}</p> : null}
      {(r.tags?.length ?? 0) > 0 ? <p className="text-zinc-500">Tags: {r.tags!.join(" · ")}</p> : null}
      <div className="flex flex-wrap gap-3 text-[9px] text-zinc-600">
        {r.propertyId ? <span>property_id · {r.propertyId.slice(0, 8)}…</span> : null}
        {r.tenantId ? <span>tenant_id · {r.tenantId.slice(0, 8)}…</span> : null}
        {r.tenancyId ? <span>tenancy_id · {r.tenancyId.slice(0, 8)}…</span> : null}
      </div>
    </div>
  );
}

/** Collapsed audit row — used for successful / vacant lists below the fold. */
function AuditImportRowCard({ r }: { r: BatchImportDetailRow }) {
  return (
    <details className="group border-b border-[#282828] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-3 marker:content-none hover:bg-[#1A1A1A]/80 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tabular-nums text-zinc-500">#{r.line}</span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{r.propertyAddress || "—"}</p>
          </div>
          <CompactRowPreview r={r} />
        </div>
        <ChevronDown className="mt-1 size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
      </summary>
      <RowDetailsBody r={r} />
    </details>
  );
}

function FailedRowCard({ r }: { r: BatchImportDetailRow }) {
  const reason = primaryAttentionReason(r);

  return (
    <details className="group border-b border-[#282828] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-3 marker:content-none hover:bg-[#1A1A1A]/80 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start gap-2">
            <span className="font-mono text-[10px] tabular-nums text-zinc-500">Row {r.line}</span>
            <span className="inline-flex shrink-0 border border-[#BB5551]/45 bg-[#2a1514]/80 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ee7d77]">
              Not saved
            </span>
          </div>
          <p className="text-sm font-medium text-white">{humanRecordLabel(r)}</p>
          <ExpandableInstructionText
            text={reason}
            className="text-[12px] leading-snug text-zinc-400"
            collapsedClampClassName="line-clamp-2"
            stopDetailsToggle
          />
          <Link
            href="/dashboard/import"
            className="inline-flex border border-[#BB5551]/40 bg-[#2a1514]/50 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ee7d77] hover:border-[#ee7d77]/60"
          >
            Try import again
          </Link>
        </div>
        <ChevronDown className="mt-1 size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
      </summary>
      <RowDetailsBody r={r} />
    </details>
  );
}

function RowListQuiet({ rows, emptyLabel }: { rows: BatchImportDetailRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="px-3 py-8 text-center text-sm text-zinc-500">{emptyLabel}</p>;
  }
  return (
    <div>
      {rows.map((r) => (
        <AuditImportRowCard key={r.rowIndex} r={r} />
      ))}
    </div>
  );
}

export function PortfolioImportBatchReconciliation({
  batchId,
  headline,
  sub,
  bandClass,
  completedAt,
  finalizeError,
  dbStatus,
  rowsTotal,
  skippedCount,
  model,
  rawRows,
  retryFailedAvailable,
}: {
  batchId: string;
  headline: string;
  sub: string;
  bandClass: string;
  completedAt: string | null;
  finalizeError: string | null;
  dbStatus: string;
  rowsTotal: number;
  skippedCount: number;
  model: BatchReconciliationModel;
  rawRows: BatchImportDetailRow[];
  retryFailedAvailable: boolean;
}) {
  const reviewIdx = useMemo(() => new Set(model.needsReview.map((r) => r.rowIndex)), [model.needsReview]);

  const cleanSuccessful = useMemo(
    () => model.successfulImports.filter((r) => !reviewIdx.has(r.rowIndex)),
    [model.successfulImports, reviewIdx],
  );

  const batchQ = `importBatch=${encodeURIComponent(batchId)}`;
  const needsReviewTotal = model.needsReviewQueue.length;
  const failedCount = model.failed.length;

  const needsReviewKey = useMemo(
    () => model.needsReviewQueue.map(({ row }) => row.line).join(","),
    [model.needsReviewQueue],
  );

  const needsReviewSnapshotRef = useRef(model.needsReviewQueue);
  needsReviewSnapshotRef.current = model.needsReviewQueue;

  const [dismissedReviewLines, setDismissedReviewLines] = useState<Set<number>>(() => new Set());

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const q = needsReviewSnapshotRef.current;
    if (q.length === 0) {
      setDismissedReviewLines(new Set());
      return;
    }
    const loaded = loadDismissedReviewLines(batchId, q);
    setDismissedReviewLines(loaded);
    saveDismissedReviewLines(batchId, loaded);
  }, [batchId, needsReviewKey]);

  const activeReviewQueue = useMemo(
    () => model.needsReviewQueue.filter(({ row }) => !dismissedReviewLines.has(row.line)),
    [dismissedReviewLines, model.needsReviewQueue],
  );

  const reviewedArchiveQueue = useMemo(
    () => model.needsReviewQueue.filter(({ row }) => dismissedReviewLines.has(row.line)),
    [dismissedReviewLines, model.needsReviewQueue],
  );

  const pendingReviewCount = activeReviewQueue.length;
  const hasAttention = pendingReviewCount > 0 || failedCount > 0;

  const markReviewLineDone = useCallback((line: number) => {
    setDismissedReviewLines((prev) =>
      mergeDismissedWithQueue(batchId, new Set(prev).add(line), needsReviewSnapshotRef.current),
    );
  }, [batchId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const { hash } = window.location;
    const map: Record<string, string> = {
      "#failed": "attention-failed",
      "#import-section-failed": "attention-failed",
      "#review": "attention-review",
      "#import-section-review": "attention-review",
    };
    const id = map[hash];
    if (!id) return;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const propDisabled = model.filterSets.propertyIds.length === 0;
  const tenDisabled = model.filterSets.tenantIds.length === 0;
  const tencyDisabled = model.filterSets.tenancyIds.length === 0;

  const completedLabel = completedAt ? batchCompletedFormatter.format(new Date(completedAt)) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#131313] text-[#e5e2e1]">
      <header className="border-b border-[#282828] bg-[#161616] px-6 py-4">
        <Link
          href="/dashboard/import"
          className="mb-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#888888] hover:text-white"
        >
          <ArrowLeft className="size-3" />
          Back to import
        </Link>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#555555]">Batch</p>
        <h1 className="mt-1 text-xl font-bold uppercase tracking-tight text-white">Results</h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#555555]">{batchId}</p>
      </header>

      <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-8">
        <section className={cn("rounded-sm border px-5 py-6", bandClass)}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#888888]">Summary</p>
          <h2 className="mt-2 text-lg font-bold text-white sm:text-xl">{headline}</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-snug text-[#cfc9c4]">{sub}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#888888]">Saved cleanly</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">{cleanSuccessful.length}</dd>
            </div>
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#f8cf83]">Quick checks left</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#f8cf83]">{pendingReviewCount}</dd>
            </div>
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#ee7d77]">Didn&apos;t save</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#ee7d77]">{failedCount}</dd>
            </div>
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#888888]">Properties</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
                {model.summary.propertiesCreated}
              </dd>
            </div>
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#888888]">Tenants</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
                {model.summary.tenantsCreated}
              </dd>
            </div>
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#888888]">Tenancies</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
                {model.summary.tenanciesCreated}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] text-[#555555]">
            <span>Rows in file · {rowsTotal}</span>
            <span>Skipped · {skippedCount}</span>
            <span className="uppercase">DB · {dbStatus}</span>
          </div>

          {finalizeError ? (
            <p className="mt-4 max-w-2xl rounded-sm border border-[#BB5551]/35 bg-[#2a1514]/80 px-3 py-2 font-mono text-[11px] leading-snug text-[#ee7d77]">
              DB: {finalizeError}
            </p>
          ) : null}

          {completedLabel ? (
            <p className="mt-4 font-mono text-[10px] text-[#555555]">Completed · {completedLabel}</p>
          ) : null}
        </section>

        <section className="scroll-mt-24 space-y-4" aria-label="After import tasks" id="attention">
          {pendingReviewCount > 0 ? (
            <div className="max-w-xl space-y-2 text-[13px] leading-snug text-[#cfc9c4]" id="batch-review-directive">
              <p>Check this record.</p>
              <p>If it looks right, click Reviewed.</p>
              <p>If it looks wrong, open it and fix it.</p>
            </div>
          ) : null}

          <div className="max-w-xl space-y-2 text-[12px] leading-relaxed text-zinc-500">
            <p>
              <span className="font-medium text-zinc-300">Retry failed rows</span> opens the importer with only lines that didn&apos;t
              save, using data from this batch — no spreadsheet upload.
            </p>
            <p>
              <span className="font-medium text-zinc-300">Upload again</span> starts a{" "}
              <span className="text-zinc-400">new</span> full import when you paste or upload a file.
            </p>
            {failedCount > 0 && !retryFailedAvailable ? (
              <p className="text-[#ee7d77]/90">
                Stored row details aren&apos;t available for this older import — use Upload again with your file. Saved records still match
                and won&apos;t duplicate.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {retryFailedAvailable ? (
              <Link
                href={`/dashboard/import?retryBatch=${encodeURIComponent(batchId)}`}
                className="inline-flex items-center justify-center gap-2 border border-[#f8cf83]/50 bg-[#2a2210]/60 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#f8cf83] transition-colors hover:border-[#f8cf83]"
              >
                Retry failed rows
              </Link>
            ) : null}
            <Link
              href="#attention-failed"
              className={cn(
                "inline-flex items-center justify-center gap-2 border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
                failedCount === 0
                  ? "pointer-events-none border-zinc-800 bg-zinc-900/40 text-zinc-600"
                  : "border-[#BB5551]/45 bg-[#2a1514]/50 text-[#ee7d77] hover:border-[#ee7d77]/50",
              )}
            >
              Jump to failures
            </Link>
            <Link
              href="/dashboard/import"
              className="inline-flex items-center justify-center gap-2 border border-[#306f60]/50 bg-[#152420] px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#afefdd] hover:border-[#afefdd]/50"
            >
              Upload again
            </Link>
          </div>

          {!hasAttention ? (
            <p className="rounded-sm border border-[#306f60]/30 bg-[#152420]/40 px-3 py-3 text-[12px] text-[#afefdd]">
              You’re caught up — nothing urgent from this upload.
            </p>
          ) : null}

          {needsReviewTotal > 0 ? (
            <div id="attention-review" className="scroll-mt-24 overflow-hidden rounded-sm border border-[#f8cf83]/20 bg-[#161616]">
              <div className="border-b border-[#f8cf83]/15 bg-[#2a2210]/30 px-3 py-2.5">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#f8cf83]">Quick checks</h3>
              </div>
              <ReviewQueueSection batchId={batchId} queue={activeReviewQueue} onMarkReviewed={markReviewLineDone} />
              <ReviewedQueueCollapsible entries={reviewedArchiveQueue} />
            </div>
          ) : null}

          <div id="attention-failed" className="scroll-mt-24 overflow-hidden rounded-sm border border-[#BB5551]/25 bg-[#161616]">
            <div className="border-b border-[#BB5551]/15 bg-[#2a1514]/30 px-3 py-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#ee7d77]">Didn&apos;t save</h3>
            </div>
            <p className="border-b border-[#282828] px-3 py-3 text-[13px] leading-snug text-zinc-400">
              Failed rows were not imported. Fix the file and import again.
            </p>
            {model.failed.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-zinc-500">None.</p>
            ) : (
              <div>
                {model.failed.map((r) => (
                  <FailedRowCard key={r.rowIndex} r={r} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section aria-label="From this upload">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white">Saved in Letora · this upload</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={`/dashboard/properties?${batchQ}`}
              aria-disabled={propDisabled}
              className={cn(
                "inline-flex items-center justify-center gap-2 border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
                propDisabled
                  ? "pointer-events-none border-zinc-800 bg-zinc-900/40 text-zinc-600"
                  : "border-[#306f60]/50 bg-[#152420] text-[#afefdd] hover:border-[#afefdd]/50",
              )}
            >
              Properties · this upload
            </Link>
            <Link
              href={`/dashboard/tenants?${batchQ}`}
              className={cn(
                "inline-flex items-center justify-center gap-2 border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
                tenDisabled
                  ? "pointer-events-none border-zinc-800 bg-zinc-900/40 text-zinc-600"
                  : "border-[#333333] bg-[#0B0B0B] text-zinc-200 hover:border-white hover:text-white",
              )}
            >
              Tenants · this upload
            </Link>
            <Link
              href={`/dashboard/tenancies?${batchQ}`}
              className={cn(
                "inline-flex items-center justify-center gap-2 border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
                tencyDisabled
                  ? "pointer-events-none border-zinc-800 bg-zinc-900/40 text-zinc-600"
                  : "border-[#333333] bg-[#0B0B0B] text-zinc-200 hover:border-white hover:text-white",
              )}
            >
              Tenancies · this upload
            </Link>
          </div>
          {propDisabled && tenDisabled && tencyDisabled ? (
            <p className="mt-3 max-w-xl text-[11px] text-zinc-500">No quick links yet — use quick checks above or the audit list at the bottom.</p>
          ) : null}
        </section>

        {model.suspicious.length > 0 ? (
          <section className="space-y-2 rounded-sm border border-[#f8cf83]/25 bg-[#2a2210]/40 px-4 py-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#f8cf83]">Suspicious</h3>
            <ul className="space-y-2">
              {model.suspicious.map((f: SuspiciousFlag, i: number) => (
                <li key={i} className="font-mono text-[11px] leading-relaxed text-[#f8cf83]">
                  <span className="uppercase">[{f.code}]</span> {f.detail}{" "}
                  <span className="text-zinc-500">Lines {f.lines.join(", ")}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <details id="import-section-clean" className="group rounded-sm border border-[#282828] bg-[#161616]">
          <summary className="cursor-pointer px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400 marker:content-none [&::-webkit-details-marker]:hidden">
            Clean saves &amp; vacant rows ({cleanSuccessful.length + model.vacantOrPropertyOnly.length})
          </summary>
          <div className="space-y-6 border-t border-[#282828] px-4 py-5">
            <div>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#888888]">No flags</h3>
              <div className="overflow-hidden rounded-sm border border-[#282828] bg-[#0d0d0d]">
                <RowListQuiet
                  rows={cleanSuccessful}
                  emptyLabel="None."
                />
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#888888]">Vacant</h3>
              <div className="overflow-hidden rounded-sm border border-[#282828] bg-[#0d0d0d]">
                <RowListQuiet rows={model.vacantOrPropertyOnly} emptyLabel="None." />
              </div>
            </div>
          </div>
        </details>

        <details className="group rounded-sm border border-[#282828] bg-[#161616] px-4 py-3">
          <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Audit trail ({rawRows.length})
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[10px]">
              <thead>
                <tr className="border-b border-[#282828] text-[9px] uppercase tracking-widest text-zinc-500">
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Outcome</th>
                  <th className="px-2 py-2">Kind</th>
                  <th className="px-2 py-2">Property</th>
                  <th className="px-2 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rawRows.map((r) => (
                  <tr key={r.rowIndex} className="border-b border-[#282828] align-top text-zinc-400">
                    <td className="px-2 py-2 font-mono tabular-nums">{r.line}</td>
                    <td className="px-2 py-2">{r.outcome}</td>
                    <td className="px-2 py-2">{rowKindNorm(r) || "—"}</td>
                    <td className="px-2 py-2 text-zinc-300">{r.propertyAddress || "—"}</td>
                    <td className="max-w-md px-2 py-2">
                      {[...r.previewErrors, ...r.previewWarnings, r.runtimeError, r.skipReason]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
}
