"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  MessageSquare,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";

import {
  previewBatchOnboardingFromFormData,
  prepareRetryFailedRowsFromBatchAction,
  startBatchOnboardingAction,
  type BatchImportHistoryRow,
} from "@/lib/actions/batch-onboarding";
import {
  PortfolioImportPreflight,
} from "@/components/import/portfolio-import-preflight";
import { filterRowsForCommit } from "@/components/import/portfolio-import-preflight-model";
import type { PreparedRow } from "@/lib/onboarding/batch-onboard";
import { PORTFOLIO_IMPORT_SCHEMA_GUIDE } from "@/lib/onboarding/portfolio-import-schema";
import { PricingPlanSubscribeButton } from "@/components/marketing/pricing-plan-button";
import { cn } from "@/lib/utils";

import {
  clearPortfolioImportDraft,
  loadPortfolioImportDraft,
  savePortfolioImportDraft,
  type PortfolioImportDraftSummary,
} from "@/components/import/portfolio-import-draft-storage";

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="size-3.5 text-[#afefdd]" />;
  if (status === "failed") return <XCircle className="size-3.5 text-[#ee7d77]" />;
  if (status === "running") return <Loader2 className="size-3.5 animate-spin text-[#f8cf83]" />;
  return <CheckCircle2 className="size-3.5 text-[#555555]" />;
}

/** Deterministic UK timestamps for SSR + client (avoids `Date#toLocaleString()` env mismatch). */
const importBatchCreatedAtFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Europe/London",
});

function formatImportBatchCreatedAt(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return importBatchCreatedAtFormatter.format(new Date(ms));
}

export function BatchOnboardingImport({
  history,
  retryBatchId = null,
}: {
  history: BatchImportHistoryRow[];
  retryBatchId?: string | null;
}) {
  const router = useRouter();

  const [csvText, setCsvText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreparedRow[] | null>(null);
  const [summary, setSummary] = useState<PortfolioImportDraftSummary | null>(null);
  const [excludedRowIndices, setExcludedRowIndices] = useState<Set<number>>(() => new Set());
  const [importOnlyClean, setImportOnlyClean] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFailureKind, setImportFailureKind] = useState<"none" | "plan_limit" | "other">("none");
  const [checkoutFlash, setCheckoutFlash] = useState<"success" | "cancelled" | null>(null);
  const [hasStoredImportDraft, setHasStoredImportDraft] = useState(false);
  const [isPreviewing, startPreview] = useTransition();
  const [isImportPending, startImport] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [confirmCommit, setConfirmCommit] = useState(false);
  const [retryFromBatchContext, setRetryFromBatchContext] = useState<string | null>(null);
  const [retryBatchLoadError, setRetryBatchLoadError] = useState<string | null>(null);
  const [isRetryBatchHydrating, setIsRetryBatchHydrating] = useState(() => Boolean(retryBatchId));

  const importInFlightRef = useRef(false);
  const lastImportFingerprintRef = useRef("");
  const lastImportAtRef = useRef(0);

  function refreshStoredDraftFlag() {
    setHasStoredImportDraft(loadPortfolioImportDraft() !== null);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success") {
      setCheckoutFlash("success");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (checkout === "cancelled") {
      setCheckoutFlash("cancelled");
      window.history.replaceState({}, "", window.location.pathname);
    }
    refreshStoredDraftFlag();
  }, []);

  useEffect(() => {
    if (!retryBatchId) {
      setIsRetryBatchHydrating(false);
      return;
    }
    let cancelled = false;
    setRetryBatchLoadError(null);
    setIsRetryBatchHydrating(true);
    setError(null);
    setImportError(null);
    setImportFailureKind("none");

    void (async () => {
      const res = await prepareRetryFailedRowsFromBatchAction(retryBatchId);
      if (cancelled) return;
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/dashboard/import");
      }
      if (res.ok === false) {
        setRetryBatchLoadError(res.error);
        setRows(null);
        setSummary(null);
        setConfirmCommit(false);
        setRetryFromBatchContext(null);
        setIsRetryBatchHydrating(false);
        return;
      }
      clearPortfolioImportDraft();
      setHasStoredImportDraft(false);
      setRows(res.rows);
      setSummary(res.summary);
      setExcludedRowIndices(new Set());
      setImportOnlyClean(false);
      setConfirmCommit(false);
      setRetryFromBatchContext(retryBatchId);
      setIsRetryBatchHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [retryBatchId]);

  const excludedRef = useRef(excludedRowIndices);
  excludedRef.current = excludedRowIndices;
  const importOnlyCleanRef = useRef(importOnlyClean);
  importOnlyCleanRef.current = importOnlyClean;

  /** Always point at latest preview snapshot so submit matches the manifest (avoids stale JSON). */
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const importGuideBullets = useMemo(
    () =>
      PORTFOLIO_IMPORT_SCHEMA_GUIDE.split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    [],
  );

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (!dropped) return;
    setFile(dropped);
    setCsvText("");
    resetPreview();
  }

  function resetPreview() {
    setRows(null);
    setSummary(null);
    setExcludedRowIndices(new Set());
    setImportOnlyClean(false);
    setError(null);
    setImportError(null);
    setImportFailureKind("none");
    setConfirmCommit(false);
    clearPortfolioImportDraft();
    setHasStoredImportDraft(false);
    setRetryFromBatchContext(null);
    setRetryBatchLoadError(null);
  }

  function onPreview() {
    if (!csvText.trim() && !file) {
      setError("Paste CSV text or choose a file first.");
      return;
    }
    setError(null);
    setImportFailureKind("none");
    setImportError(null);

    const formData = new FormData();
    if (file) formData.set("file", file);
    else formData.set("csvText", csvText);

    startPreview(async () => {
      const res = await previewBatchOnboardingFromFormData(formData);
      if (res.ok === false) {
        setError(res.error);
        setRows(null);
        setSummary(null);
        setConfirmCommit(false);
        return;
      }
      setRows(res.rows);
      setSummary(res.summary);
      setExcludedRowIndices(new Set());
      setImportOnlyClean(false);
      setConfirmCommit(false);
    });
  }

  function fingerprintPreparedRows(payload: PreparedRow[]): string {
    return JSON.stringify(
      payload.map((r) => ({
        i: r.rowIndex,
        k: r.raw.rowKind,
        addr: r.raw.propertyAddress,
        email: r.raw.tenantEmail ?? "",
        tags: [...r.tags].sort(),
        skip: r.skipReason ?? "",
        errs: [...r.raw.rowErrors],
        warns: [...r.raw.rowWarnings],
      })),
    );
  }

  function onRun() {
    if (isImportPending || importInFlightRef.current) return;
    const latestRows = rowsRef.current;
    if (!latestRows || latestRows.length === 0) return;
    const toSend = filterRowsForCommit(latestRows, {
      excluded: excludedRef.current,
      onlyNoWarnings: importOnlyCleanRef.current,
    });
    if (toSend.length === 0) return;
    setImportError(null);
    setError(null);

    const fp = fingerprintPreparedRows(toSend);
    const now = Date.now();
    if (
      fp === lastImportFingerprintRef.current &&
      now - lastImportAtRef.current < 12_000
    ) {
      setImportError(
        "This preview was just submitted. Wait for navigation to the batch result, or refresh if nothing happens — double imports are blocked for a few seconds.",
      );
      setImportFailureKind("other");
      return;
    }

    startImport(async () => {
      if (importInFlightRef.current) return;
      importInFlightRef.current = true;
      lastImportFingerprintRef.current = fp;
      lastImportAtRef.current = Date.now();
      try {
        const res = await startBatchOnboardingAction(JSON.stringify(toSend));
        if (res.ok === false) {
          const hitLimit = res.reason === "plan_limit";
          if (hitLimit && summary) {
            savePortfolioImportDraft(latestRows, summary, {
              excludedRowIndices: excludedRef.current.size > 0 ? [...excludedRef.current] : undefined,
              importOnlyNoWarnings: importOnlyCleanRef.current || undefined,
            });
            setHasStoredImportDraft(true);
          }
          setImportError(res.error);
          setImportFailureKind(hitLimit ? "plan_limit" : "other");
          if ("finalizeFailed" in res && res.finalizeFailed && "batchId" in res && res.batchId) {
            router.push(`/dashboard/import/batch/${res.batchId}`);
          }
          return;
        }
        clearPortfolioImportDraft();
        setHasStoredImportDraft(false);
        router.push(`/dashboard/import/batch/${res.batchId}`);
      } finally {
        importInFlightRef.current = false;
      }
    });
  }

  const sidebarPreflightMuted =
    summary !== null && rows !== null && rows.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background dark:bg-[#f8f8f7] text-zinc-950 dark:bg-[#131313] dark:text-[#e5e2e1]">
      {/* ── Page Header ── */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-200 dark:border-[#282828] dark:bg-[#161616]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-[#555555]">
          Import Console
        </p>
        <h1 className="mt-1 text-xl font-bold uppercase tracking-tight text-zinc-900 dark:text-white">
          Portfolio Import
        </h1>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500 dark:text-[#555555]">
          Import Portfolio · Run agents at scale
        </p>
      </header>

      {checkoutFlash ? (
        <div className="flex items-start justify-between gap-3 border-b border-border dark:border-[#306f60]/35 bg-background dark:bg-[#152420]/80 px-6 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#afefdd]">
              {checkoutFlash === "success" ? "Billing update received" : "Checkout cancelled"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#c8dfd7]">
              {checkoutFlash === "success"
                ? hasStoredImportDraft
                  ? "You were returned here from checkout. Restore your saved preview below, confirm in step 02, then import your ready rows."
                  : "You were returned here from checkout. If your preview table is empty, paste or upload again and click Preview Rows before importing."
                : "No charge was taken. Any preview saved earlier in this tab is still available below."}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-[#888888] transition-colors hover:text-zinc-900 dark:hover:text-zinc-900 dark:text-white"
            aria-label="Dismiss billing notice"
            onClick={() => setCheckoutFlash(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {isRetryBatchHydrating ? (
        <div className="flex items-center gap-3 border-b border-border dark:border-[#f8cf83]/25 bg-background dark:bg-[#2a2210]/45 px-6 py-3">
          <Loader2 className="size-4 shrink-0 animate-spin text-[#f8cf83]" aria-hidden />
          <p className="text-[12px] leading-snug text-[#e5e2e1]">Loading failed rows from that import into the preflight editor…</p>
        </div>
      ) : null}

      {retryBatchLoadError ? (
        <div className="flex items-start justify-between gap-3 border-b border-border dark:border-[#BB5551]/40 bg-background dark:bg-[#2a1514]/60 px-6 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#ee7d77]">Could not open retry</p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{retryBatchLoadError}</p>
          </div>
          <button
            type="button"
            className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-[#888888] transition-colors hover:text-zinc-900 dark:hover:text-zinc-900 dark:text-white"
            aria-label="Dismiss retry error"
            onClick={() => setRetryBatchLoadError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {retryFromBatchContext && !isRetryBatchHydrating ? (
        <div className="border-b border-border dark:border-[#f8cf83]/25 bg-background dark:bg-[#2a2210]/35 px-6 py-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#f8cf83]">Retry mode</p>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[#cfc9c4]">
            <span className="font-medium text-zinc-900 dark:text-white">Retry failed rows</span> uses only the lines that didn&apos;t save on batch{" "}
            <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">{retryFromBatchContext.slice(0, 8)}…</span> — edit below, run
            preview checks, then import. Letora matches what already exists, so successful rows aren&apos;t touched.
          </p>
          <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-zinc-500">
            <span className="font-medium text-zinc-400">Upload again</span> starts a separate full import when you paste or upload a file in step&nbsp;01.
          </p>
          <Link
            href={`/dashboard/import/batch/${encodeURIComponent(retryFromBatchContext)}`}
            className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#888888] transition-colors hover:text-zinc-900 dark:hover:text-zinc-900 dark:text-white"
          >
            Back to batch results
          </Link>
        </div>
      ) : null}

      {hasStoredImportDraft ? (
        <div className="flex flex-col gap-2 border-b border-border dark:border-[#306f60]/25 bg-background dark:bg-[#1a2824]/70 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#afefdd]">
              Saved preview in this browser
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#bdbdbd]">
              Restoring reloads your last staged rows and manifest stats from this device. Clearing your browser storage removes it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 border border-border dark:border-[#afefdd]/40 bg-background dark:bg-[#afefdd] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#161616] transition-colors hover:bg-white"
              onClick={() => {
                const d = loadPortfolioImportDraft();
                if (!d?.rows?.length) {
                  refreshStoredDraftFlag();
                  return;
                }
                setRows(d.rows);
                setSummary(d.summary);
                setExcludedRowIndices(new Set(d.excludedRowIndices ?? []));
                setImportOnlyClean(!!d.importOnlyNoWarnings);
                setImportError(null);
                setImportFailureKind("none");
                setConfirmCommit(false);
              }}
            >
              Restore prepared import
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 border border-border dark:border-[#333333] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#bbbbbb] transition-colors hover:border-white hover:text-white"
              onClick={() => {
                clearPortfolioImportDraft();
                setHasStoredImportDraft(false);
              }}
            >
              Discard saved preview
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Left: Main Flow ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-px">

            {/* ── Step 01: Provide Portfolio ── */}
            <section className="border-b border-zinc-200 dark:border-[#282828]">
              {/* Step header */}
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#282828] bg-zinc-100 px-4 py-3 dark:bg-[#1A1A1A]">
                <div className="flex items-center gap-3">
                  <span className="bg-white px-1.5 py-0.5 font-mono text-[10px] font-black text-[#161616] dark:bg-white">
                    01
                  </span>
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-900 dark:text-white">
                    Provide your portfolio
                  </h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="/templates/portfolio-import-sample.csv"
                    download
                    className="inline-flex items-center gap-1.5 border border-border dark:border-[#afefdd]/30 bg-background dark:bg-[#152420] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#afefdd] transition-colors hover:border-border dark:border-[#afefdd]/50"
                  >
                    <Download className="size-3" />
                    Sample CSV
                  </a>
                  <a
                    href="/templates/tenant-batch-template.csv"
                    download
                    className="inline-flex items-center gap-1.5 border border-zinc-200 bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-200 transition-colors hover:border-zinc-400 hover:text-white dark:border-[#333333] dark:bg-[#0B0B0B] dark:text-[#888888]"
                  >
                    <Download className="size-3" />
                    Minimal template
                  </a>
                </div>
              </div>

              {/* Upload + Paste grid */}
              <div className="grid grid-cols-1 gap-px bg-zinc-200 sm:grid-cols-2 dark:bg-[#282828]">
                {/* Drop zone */}
                <label
                  htmlFor="batch-file"
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "group flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 px-6 text-center transition-colors",
                    isDragging
                      ? "border border-dashed border-zinc-900 bg-zinc-100 dark:border-white dark:bg-[#1A1A1A]"
                      : file
                        ? "bg-background dark:bg-[#152420]"
                        : "bg-zinc-50 hover:bg-zinc-100 dark:bg-[#131313] dark:hover:bg-background dark:bg-[#1A1A1A]",
                  )}
                >
                  <Upload
                    className={cn(
                      "size-6 transition-colors",
                      isDragging
                        ? "text-zinc-900 dark:text-white"
                        : file
                          ? "text-[#afefdd]"
                          : "text-zinc-400 group-hover:text-zinc-600 dark:text-[#444748] dark:group-hover:text-[#888888]",
                    )}
                  />
                  <span className="text-[11px] font-medium text-zinc-900 dark:text-white">
                    {isDragging ? "Drop to upload" : file ? file.name : "Drop or choose a file"}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 dark:text-[#444748]">
                    {file && !isDragging ? `${(file.size / 1024).toFixed(1)} KB` : "CSV · TSV · TXT · DOCX · PDF"}
                  </span>
                  <input
                    id="batch-file"
                    type="file"
                    accept=".csv,.tsv,.txt,.docx,.pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const next = e.target.files?.[0] ?? null;
                      setFile(next);
                      if (next) setCsvText("");
                      resetPreview();
                    }}
                  />
                </label>

                {/* Paste CSV */}
                <div className="flex flex-col gap-2 bg-white p-4 dark:bg-[#131313]">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="batch-csv"
                      className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#555555]"
                    >
                      Or paste CSV
                    </label>
                    <span className="font-mono text-[9px] text-zinc-400 dark:text-[#444748]">
                      detecting_headers...
                    </span>
                  </div>
                  <textarea
                    id="batch-csv"
                    placeholder={`row_kind,property_address,city,postcode,tenant_name,tenant_email,monthly_rent,start_date\noccupied,"12 Oak St",London,E2 7AA,Alex Stone,alex@mail.com,1850,2026-05-01\nvacant,"99 Empty Rd",Leeds,LS1 1AA,,,0,`}
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      if (e.target.value) setFile(null);
                      resetPreview();
                    }}
                    className="min-h-[164px] flex-1 resize-none border border-zinc-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-[#282828] dark:bg-[#0B0B0B] dark:text-[#c4c7c8] dark:placeholder-[#333333] dark:focus:border-white"
                  />
                </div>
              </div>

              {/* Footer bar */}
              <div className="flex items-center justify-between border-t border-zinc-200 dark:border-[#282828] bg-zinc-100 px-4 py-3 dark:bg-[#1A1A1A]">
                <div className="flex items-center gap-4 text-[9px] uppercase tracking-widest text-zinc-500 dark:text-[#555555]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-[#afefdd]" />
                    UTF-8 Encoding
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-[#afefdd]" />
                    Auto-mapping
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {rows ? (
                    <button
                      type="button"
                      onClick={resetPreview}
                      className="border border-zinc-200 bg-white px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-[#333333] dark:bg-[#0B0B0B] dark:text-[#888888] dark:hover:text-white"
                    >
                      Reset
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onPreview}
                    disabled={isPreviewing || isImportPending}
                    className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 px-5 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-[#161616]"
                  >
                    {isPreviewing ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        Analysing
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3" />
                        Preview Rows
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error bar */}
              {error ? (
                <div className="flex items-start gap-2 border-t border-border dark:border-[#BB5551]/30 bg-background dark:bg-[#7f2927]/10 px-4 py-3">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#ee7d77]" />
                  <span className="text-[11px] text-[#ee7d77]">{error}</span>
                </div>
              ) : null}
            </section>

            {summary && rows ? (
              <>
                {isImportPending ? (
                  <div className="flex items-start gap-3 border-b border-border dark:border-[#f8cf83]/25 bg-background dark:bg-[#2a2210]/90 px-4 py-4">
                    <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-[#f8cf83]" aria-hidden />
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#f8cf83]">
                        Import in progress
                      </p>
                      <p className="mt-2 text-[12px] leading-relaxed text-zinc-700 dark:text-[#e5e2e1]">
                        Writing properties, tenants, tenancies, and rent rows. Do not close this tab — you will be taken to
                        the batch result when finished.
                      </p>
                    </div>
                  </div>
                ) : null}

                {importError ? (
                  <div className="flex items-start gap-3 border-b border-border dark:border-[#BB5551]/35 bg-background dark:bg-[#7f2927]/15 px-4 py-3">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#ee7d77]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#ee7d77]">
                        {importFailureKind === "plan_limit" ? "Free workspace limit" : "Import could not complete"}
                      </p>
                      <p className="mt-1 text-[11px] text-[#ffb3ad]">{importError}</p>
                      {importFailureKind === "plan_limit" ? (
                        <>
                          <p className="mt-2 text-[11px] leading-relaxed text-[#e8c8c5]">
                            Your latest preview snapshot can be saved with “Save and finish later” in step 02. Restore from
                            the banner at the top of this page after you subscribe, or paste and run Preview Rows again.
                          </p>
                          <div className="mt-4 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
                            <div className="sm:min-w-[220px] sm:flex-1 [&_button]:min-h-[44px] [&_button]:text-xs">
                              <PricingPlanSubscribeButton
                                planKey="monthly"
                                highlighted
                                checkoutReturnTarget="import"
                              >
                                Subscribe · monthly
                              </PricingPlanSubscribeButton>
                            </div>
                            <Link
                              href="/dashboard/billing"
                              className="inline-flex shrink-0 items-center justify-center gap-2 border border-border dark:border-[#5c2d2a]/50 bg-background dark:bg-[#1a1212] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ffb3ad] transition-colors hover:border-border dark:border-[#ee7d77]/50 hover:text-white"
                            >
                              Open billing
                              <ChevronRight className="size-3.5" aria-hidden />
                            </Link>
                          </div>
                          <p className="mt-3 text-[10px] leading-relaxed text-[#c49a97]">
                            Subscribing opens Polar checkout for Letora Starter (monthly billing by default). Use Billing
                            after checkout for invoices and renewal dates. You can switch to yearly billing there if
                            available.
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <PortfolioImportPreflight
                  rows={rows}
                  summary={summary}
                  onRowsSummaryChange={(r, s) => {
                    setRows(r);
                    setSummary(s);
                  }}
                  excluded={excludedRowIndices}
                  onExcludedChange={setExcludedRowIndices}
                  importOnlyClean={importOnlyClean}
                  onImportOnlyCleanChange={setImportOnlyClean}
                  confirmCommit={confirmCommit}
                  onConfirmCommitChange={setConfirmCommit}
                  isImportPending={isImportPending}
                  isPreviewing={isPreviewing}
                  onImport={onRun}
                />
              </>
            ) : null}

            {/* ── Or Use Chat ── */}
            <section className="border-t border-zinc-200 bg-white px-4 py-5 dark:border-[#282828] dark:bg-[#0B0B0B]">
              <div className="flex items-start gap-4">
                <div className="flex size-8 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-100 dark:border-[#333333] dark:bg-[#1A1A1A]">
                  <MessageSquare className="size-3.5 text-zinc-500 dark:text-[#555555]" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#555555]">
                    Or use Chat
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600 dark:text-[#888888]">
                    Paste the same CSV into the assistant and say{" "}
                    <span className="font-medium text-zinc-900 dark:text-white">&ldquo;onboard these tenants&rdquo;</span>. The CEO agent
                    previews and onboards after you confirm.
                  </p>
                  <Link
                    href="/dashboard"
                    className="mt-3 inline-block border-b border-zinc-400 pb-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-600 transition-all hover:border-zinc-900 hover:text-zinc-900 dark:border-[#444748] dark:text-[#888888] dark:hover:border-white dark:hover:text-white"
                  >
                    Open Assistant
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ── Right Sidebar: muted while preflight is active so editing stays focal ── */}
        <aside
          className={cn(
            "hidden w-64 shrink-0 flex-col border-l border-zinc-200 bg-zinc-50 lg:flex dark:border-[#282828] dark:bg-[#101010]",
            sidebarPreflightMuted && "bg-zinc-100 dark:border-[#1d1d1d] dark:bg-[#101010]",
          )}
        >
          <details
            className={cn(
              "group border-b border-zinc-200 bg-white [&_summary::-webkit-details-marker]:hidden [&[open]_summary_.past-import-chevron]:rotate-180 dark:border-[#282828] dark:bg-[#1A1A1A]",
              sidebarPreflightMuted && "bg-zinc-50 dark:border-[#1d1d1d] dark:bg-[#121212]",
            )}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::marker]:content-none [&::marker]:hidden">
              <div>
                <h3 className={cn(
                  "text-[9px] font-bold uppercase tracking-widest",
                  sidebarPreflightMuted ? "text-zinc-500 dark:text-[#595959]" : "text-zinc-600 dark:text-[#888888]",
                )}>
                  Past imports
                </h3>
                <p className={cn(
                  "mt-0.5 font-mono text-[8px] uppercase tracking-wider",
                  sidebarPreflightMuted ? "text-zinc-500 dark:text-[#4a4a4a]" : "text-zinc-500 dark:text-[#555555]",
                )}>
                  Open when you need history
                </p>
              </div>
              <ChevronDown
                aria-hidden
                className="past-import-chevron size-4 shrink-0 rotate-0 text-[#555555] transition-transform"
              />
            </summary>
            <div
              className={cn(
                "max-h-[32vh] overflow-y-auto border-t border-zinc-200 bg-zinc-50 dark:border-[#282828] dark:bg-[#131313]",
                sidebarPreflightMuted && "bg-zinc-100 dark:border-[#1d1d1d] dark:bg-[#0f0f0f]",
              )}
            >
              {history.length === 0 ? (
                <div className="flex flex-col gap-3 px-6 py-8 opacity-50">
                  <div className="flex size-10 items-center justify-center border border-border dark:border-[#333333]">
                    <Upload className="size-4 text-[#555555]" />
                  </div>
                  <p className="text-center font-mono text-[9px] uppercase tracking-widest text-[#555555]">
                    No batches yet
                  </p>
                  <p className="text-center text-[9px] text-[#444748]">
                    Finished runs collect here once you confirm an import below.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-[#282828]">
                  {history.map((h) => (
                    <li key={h.id} className="hover:bg-zinc-100 dark:hover:bg-background dark:bg-[#1A1A1A]">
                      <Link
                        href={`/dashboard/import/batch/${h.id}`}
                        className="block px-4 py-3 focus-visible:outline focus-visible:outline-offset-[-2px] focus-visible:outline-[#afefdd]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <StatusIcon status={h.status} />
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-zinc-900 dark:text-white">
                                {h.rowsSucceeded}/{h.rowsTotal} onboarded
                                {h.rowsFailed > 0 ? ` · ${h.rowsFailed} failed` : ""}
                              </p>
                              <p className="font-mono text-[9px] text-[#555555]">
                                {h.agentsTriggered} agents · {h.approvalsCreated} approvals
                              </p>
                              <p className="font-mono text-[9px] text-[#444748]">
                                {formatImportBatchCreatedAt(h.createdAt)} · {h.kind}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <ChevronRight className="size-3.5 text-[#555555]" aria-hidden />
                            <span className="font-mono text-[8px] uppercase tracking-wider text-[#555555]">
                              {h.status}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          {/* Schema reference — collapsible during preflight to reduce clutter */}
          <details
            key={sidebarPreflightMuted ? "preflight-muted" : "pre-preview"}
            className={cn(
              "border-t border-zinc-200 bg-white [&_summary::-webkit-details-marker]:hidden [&[open]_summary_.guide-chevron]:rotate-180 dark:border-[#282828] dark:bg-[#1A1A1A]",
              sidebarPreflightMuted && "bg-zinc-50 dark:border-[#1d1d1d] dark:bg-[#101010]",
            )}
            {...({
              // DOM supports defaultOpen on <details>; current React typings omit it.
              defaultOpen: !sidebarPreflightMuted,
            } satisfies Record<string, unknown>)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 [&::marker]:content-none [&::marker]:hidden">
              <div>
                <p
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-widest",
                    sidebarPreflightMuted ? "text-zinc-500 dark:text-[#505050]" : "text-zinc-600 dark:text-[#555555]",
                  )}
                >
                  Import guide
                </p>
                <p
                  className={cn(
                    "mt-0.5 font-mono text-[8px] uppercase tracking-wider leading-snug",
                    sidebarPreflightMuted ? "text-zinc-500 dark:text-[#474747]" : "text-zinc-500 dark:text-[#444748]",
                  )}
                >
                  Column hints · optional unless you paste a strange export
                </p>
              </div>
              <ChevronDown
                aria-hidden
                className="guide-chevron size-4 shrink-0 rotate-0 text-[#454545] transition-transform"
              />
            </summary>
            <div className="border-t border-zinc-200 px-3 pb-3 pt-2 dark:border-[#1f1f1f]/80">
              <ul
                className={cn(
                  "max-h-[min(34vh,280px)] space-y-1.5 overflow-y-auto pr-1",
                  sidebarPreflightMuted ? "text-zinc-600 dark:text-[#595959]" : "text-zinc-700 dark:text-[#666666]",
                )}
              >
                {importGuideBullets.map((item) => (
                  <li key={item} className="flex gap-2 text-[8px] leading-snug">
                    <span
                      className={cn(
                        "mt-1.5 size-1 shrink-0 rounded-full",
                        sidebarPreflightMuted ? "bg-background dark:bg-[#333333]" : "bg-background dark:bg-[#444444]",
                      )}
                      aria-hidden
                    />
                    <span>{item.startsWith("•") ? item.slice(1).trim() : item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
