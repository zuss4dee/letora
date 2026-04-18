"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  MessageSquare,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import {
  previewBatchOnboardingFromFormData,
  startBatchOnboardingAction,
  type BatchImportHistoryRow,
} from "@/lib/actions/batch-onboarding";
import type { PreparedRow } from "@/lib/onboarding/batch-onboard";
import { cn } from "@/lib/utils";

type PreparedRowSummary = {
  total: number;
  validationErrors: number;
  newProperties: number;
  matchedProperties: number;
  existingTenants: number;
  skippedActiveTenancies: number;
  actionableRows: number;
};

type RunTotals = { total: number; succeeded: number; failed: number; skipped: number };

type Tone = "error" | "skip" | "new" | "matched" | "ok";

function rowStatusLabel(row: PreparedRow): { label: string; tone: Tone } {
  if (row.tags.includes("validation_error")) return { label: "Fix row", tone: "error" };
  if (row.tags.includes("existing_active_tenancy_skip"))
    return { label: "Already onboarded", tone: "skip" };
  if (row.tags.includes("new_property")) return { label: "New property", tone: "new" };
  if (row.tags.includes("matched_property")) return { label: "Matched", tone: "matched" };
  return { label: "Ready", tone: "ok" };
}

/** Editorial pill style — rounded-full, dot prefix, brand color per tone. */
function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const map: Record<Tone, { wrap: string; dot: string }> = {
    error: {
      wrap: "bg-[#7f2927]/10 text-[#BB5551]",
      dot: "bg-[#ee7d77]",
    },
    skip: {
      wrap: "bg-muted text-muted-foreground",
      dot: "bg-muted-foreground/60",
    },
    new: {
      wrap: "bg-[#b7f8e6]/10 text-[#7fc9b3] dark:text-[#afefdd]",
      dot: "bg-[#9bdcc7]",
    },
    matched: {
      wrap: "bg-[#4f3700]/10 text-[#BD9952]",
      dot: "bg-[#BD9952]",
    },
    ok: {
      wrap: "bg-[#4f3700]/10 text-[#BD9952]",
      dot: "bg-[#BD9952]",
    },
  };
  const s = map[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-[family-name:var(--font-inter)] text-[11px] font-bold uppercase tracking-wider",
        s.wrap,
      )}
    >
      <span className={cn("size-1 rounded-full", s.dot)} aria-hidden />
      {label}
    </span>
  );
}

/** Letora's signature gunmetal CTA — matches New property button on /properties. */
function MetallicButton({
  onClick,
  disabled,
  type = "button",
  children,
  className,
}: {
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative overflow-hidden rounded-sm px-8 py-3 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <span
        className="absolute inset-0 bg-gradient-to-tr from-[#C9C6C5] to-[#474646]"
        aria-hidden
      />
      <span className="relative flex items-center justify-center gap-3 font-[family-name:var(--font-inter)] text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-[#414040]">
        {children}
      </span>
    </button>
  );
}

/** Outlined editorial button — for secondary actions like "Download template", "Reset". */
function GhostButton({
  onClick,
  href,
  download,
  disabled,
  children,
  className,
  asLink,
}: {
  onClick?: () => void;
  href?: string;
  download?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  asLink?: boolean;
}) {
  const sharedClass = cn(
    "inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2.5 font-[family-name:var(--font-inter)] text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-[#1F2020]",
    className,
  );
  if (asLink && href) {
    return (
      <a href={href} download={download} className={sharedClass}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={sharedClass}>
      {children}
    </button>
  );
}

export function BatchOnboardingImport({ history }: { history: BatchImportHistoryRow[] }) {
  const router = useRouter();

  const [csvText, setCsvText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreparedRow[] | null>(null);
  const [summary, setSummary] = useState<PreparedRowSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runTotals, setRunTotals] = useState<RunTotals | null>(null);
  const [runBatchId, setRunBatchId] = useState<string | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isRunning, startRun] = useTransition();

  const canRun = useMemo(() => {
    if (!rows || rows.length === 0) return false;
    return rows.some(
      (r) =>
        !r.tags.includes("validation_error") &&
        !r.tags.includes("existing_active_tenancy_skip"),
    );
  }, [rows]);

  function resetPreview() {
    setRows(null);
    setSummary(null);
    setError(null);
    setRunTotals(null);
    setRunBatchId(null);
  }

  function onPreview() {
    if (!csvText.trim() && !file) {
      setError("Paste CSV text or choose a file first.");
      return;
    }
    setError(null);
    setRunTotals(null);
    setRunBatchId(null);

    const formData = new FormData();
    if (file) formData.set("file", file);
    else formData.set("csvText", csvText);

    startPreview(async () => {
      const res = await previewBatchOnboardingFromFormData(formData);
      if (!res.ok) {
        setError(res.error);
        setRows(null);
        setSummary(null);
        return;
      }
      setRows(res.rows);
      setSummary(res.summary);
    });
  }

  function onRun() {
    if (!rows) return;
    setError(null);
    startRun(async () => {
      const res = await startBatchOnboardingAction(JSON.stringify(rows));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRunTotals(res.totals);
      setRunBatchId(res.batchId);
      router.refresh();
    });
  }

  return (
    <div className="relative min-h-0 flex-1 bg-background">
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-2 sm:px-6 md:px-12 md:pb-28 md:pt-4">
        {/* ───────────── Editorial header ───────────── */}
        <header className="mb-8 max-w-6xl md:mb-16">
          <h1 className="font-headline text-2xl font-extralight tracking-[0.05em] text-foreground sm:text-3xl md:text-5xl">
            Batch Onboarding
          </h1>
          <div className="mt-3 hidden items-center gap-4 sm:flex">
            <span className="h-px w-12 bg-[#BD9952]" aria-hidden />
            <p className="font-[family-name:var(--font-inter)] text-sm uppercase tracking-widest text-muted-foreground">
              Import portfolio · run agents at scale
            </p>
          </div>
          <p className="mt-4 hidden max-w-2xl font-[family-name:var(--font-inter)] text-sm font-light tracking-wide text-muted-foreground sm:block">
            One CSV per tenancy. Letora resolves duplicates, creates the property and tenant
            records, opens the tenancy and dispatches the onboarding agent — welcome email,
            ID & Right-to-Rent, references.
          </p>
        </header>

        {/* ───────────── Step 1 · Upload ───────────── */}
        <div className="mb-6 border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-5">
            <div>
              <p className="font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Step 01
              </p>
              <h2 className="mt-1 font-headline text-lg font-light text-foreground sm:text-xl">
                Provide your portfolio
              </h2>
            </div>
            <GhostButton asLink href="/templates/tenant-batch-template.csv" download>
              <Download className="size-3.5" />
              Template
            </GhostButton>
          </div>

          <div className="grid gap-px bg-border/60 sm:grid-cols-2">
            {/* Drop zone */}
            <label
              htmlFor="batch-file"
              className={cn(
                "group relative flex h-44 cursor-pointer flex-col items-center justify-center gap-2 bg-card px-6 text-center transition-colors",
                file
                  ? "bg-[#BD9952]/[0.06]"
                  : "hover:bg-muted/50 dark:hover:bg-[#1F2020]",
              )}
            >
              <Upload className="size-5 text-muted-foreground transition-colors group-hover:text-[#BD9952]" />
              <span className="font-[family-name:var(--font-inter)] text-sm font-medium text-foreground">
                {file ? file.name : "Drop or choose a file"}
              </span>
              <span className="font-[family-name:var(--font-inter)] text-[11px] uppercase tracking-widest text-muted-foreground">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : "CSV · TSV · TXT · DOCX · PDF"}
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

            {/* Paste */}
            <div className="relative bg-card p-5 sm:p-6">
              <label
                htmlFor="batch-csv"
                className="font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
              >
                Or paste CSV
              </label>
              <Textarea
                id="batch-csv"
                placeholder={`property_address,city,tenant_name,tenant_email,monthly_rent,start_date\n12 Oak St,London,Alex Stone,alex@mail.com,1850,2026-05-01`}
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  if (e.target.value) setFile(null);
                  resetPreview();
                }}
                className="mt-2 h-28 resize-none rounded-sm border-border/70 bg-transparent font-mono text-[11px] leading-relaxed text-foreground/90 focus-visible:ring-[#BD9952]/30"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
            <p className="font-[family-name:var(--font-inter)] text-[11px] uppercase tracking-widest text-muted-foreground">
              Up to 100 rows · duplicates reuse existing records
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {rows ? (
                <GhostButton onClick={resetPreview}>Reset</GhostButton>
              ) : null}
              <MetallicButton onClick={onPreview} disabled={isPreviewing}>
                {isPreviewing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Analysing
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    Preview rows
                  </>
                )}
              </MetallicButton>
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 border-t border-destructive/30 bg-destructive/[0.06] px-5 py-3 sm:px-8">
              <AlertTriangle className="mt-0.5 size-4 text-destructive" />
              <span className="font-[family-name:var(--font-inter)] text-xs text-destructive">
                {error}
              </span>
            </div>
          ) : null}
        </div>

        {/* ───────────── Step 2 · Preview ───────────── */}
        {summary && rows ? (
          <div className="mb-6 border border-border bg-card">
            <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-5">
              <div>
                <p className="font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Step 02
                </p>
                <h2 className="mt-1 font-headline text-lg font-light text-foreground sm:text-xl">
                  Review the manifest
                </h2>
              </div>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <Stat label="Total" value={summary.total} />
                <Stat label="New" value={summary.newProperties} accent />
                <Stat label="Matched" value={summary.matchedProperties} />
                {summary.skippedActiveTenancies > 0 ? (
                  <Stat label="Skip" value={summary.skippedActiveTenancies} muted />
                ) : null}
                {summary.validationErrors > 0 ? (
                  <Stat label="Errors" value={summary.validationErrors} danger />
                ) : null}
              </div>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-border/70 sm:hidden">
              {rows.map((row) => {
                const status = rowStatusLabel(row);
                return (
                  <li key={`m-${row.rowIndex}`} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-[family-name:var(--font-inter)] text-sm font-semibold text-foreground">
                          {row.raw.propertyAddress || "—"}
                        </p>
                        <p className="truncate font-[family-name:var(--font-inter)] text-xs text-muted-foreground">
                          {row.raw.tenantFullName || "—"} · {row.raw.tenantEmail || "—"}
                        </p>
                      </div>
                      <StatusPill label={status.label} tone={status.tone} />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 font-[family-name:var(--font-inter)] text-[11px] tracking-wide text-muted-foreground">
                      <span className="tabular-nums">
                        {row.raw.monthlyRent > 0
                          ? `£${row.raw.monthlyRent.toLocaleString()}/mo`
                          : "—"}
                      </span>
                      <span className="tabular-nums">{row.raw.startDate || "—"}</span>
                    </div>
                    {row.raw.rowErrors.length > 0 || row.skipReason ? (
                      <p className="mt-2 font-[family-name:var(--font-inter)] text-[11px] text-muted-foreground">
                        {row.raw.rowErrors.length > 0
                          ? row.raw.rowErrors.join(", ")
                          : row.skipReason}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="bg-muted dark:bg-[#1F2020]">
                    <th className="px-6 py-4 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      #
                    </th>
                    <th className="px-6 py-4 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Property
                    </th>
                    <th className="px-6 py-4 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Tenant
                    </th>
                    <th className="px-6 py-4 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Rent
                    </th>
                    <th className="px-6 py-4 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Start
                    </th>
                    <th className="px-6 py-4 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {rows.map((row) => {
                    const status = rowStatusLabel(row);
                    return (
                      <tr
                        key={row.rowIndex}
                        className="align-top transition-colors hover:bg-muted/60 dark:hover:bg-[#252626]"
                      >
                        <td className="px-6 py-4 font-[family-name:var(--font-inter)] text-xs tabular-nums text-muted-foreground">
                          {String(row.rowIndex + 1).padStart(2, "0")}
                        </td>
                        <td className="px-6 py-4">
                          <StatusPill label={status.label} tone={status.tone} />
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-[family-name:var(--font-inter)] text-sm text-foreground">
                            {row.raw.propertyAddress || "—"}
                          </p>
                          <p className="font-[family-name:var(--font-inter)] text-[11px] tracking-wide text-muted-foreground">
                            {[row.raw.city, row.raw.postcode].filter(Boolean).join(", ") || "—"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-[family-name:var(--font-inter)] text-sm text-foreground">
                            {row.raw.tenantFullName || "—"}
                          </p>
                          <p className="truncate font-[family-name:var(--font-inter)] text-[11px] tracking-wide text-muted-foreground">
                            {row.raw.tenantEmail || "—"}
                          </p>
                        </td>
                        <td className="px-6 py-4 font-[family-name:var(--font-inter)] text-sm tabular-nums text-foreground">
                          {row.raw.monthlyRent > 0
                            ? `£${row.raw.monthlyRent.toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-6 py-4 font-[family-name:var(--font-inter)] text-xs tabular-nums text-muted-foreground">
                          {row.raw.startDate || "—"}
                        </td>
                        <td className="px-6 py-4 font-[family-name:var(--font-inter)] text-[11px] tracking-wide text-muted-foreground">
                          {row.raw.rowErrors.length > 0
                            ? row.raw.rowErrors.join(", ")
                            : row.skipReason ?? "Ready"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
              <p className="font-[family-name:var(--font-inter)] text-[11px] uppercase tracking-widest text-muted-foreground">
                {summary.actionableRows} row{summary.actionableRows === 1 ? "" : "s"} ready ·
                errors and duplicates skipped
              </p>
              <MetallicButton onClick={onRun} disabled={!canRun || isRunning}>
                {isRunning ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Onboarding
                  </>
                ) : (
                  <>
                    Onboard {summary.actionableRows} row
                    {summary.actionableRows === 1 ? "" : "s"}
                  </>
                )}
              </MetallicButton>
            </div>
          </div>
        ) : null}

        {/* ───────────── Run result ───────────── */}
        {runTotals ? (
          <div className="mb-6 border border-[#BD9952]/40 bg-[#BD9952]/[0.04]">
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
              <div>
                <p className="font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-[#BD9952]">
                  Batch complete
                </p>
                <p className="mt-1 font-headline text-lg font-light text-foreground sm:text-xl">
                  {runTotals.succeeded} onboarded · {runTotals.skipped} skipped ·{" "}
                  {runTotals.failed} failed
                </p>
                {runBatchId ? (
                  <p className="mt-1 font-[family-name:var(--font-inter)] text-[11px] uppercase tracking-widest text-muted-foreground">
                    Ref {runBatchId.slice(0, 8)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <GhostButton asLink href="/dashboard/tenants">
                  View tenants
                </GhostButton>
                <Link
                  href="/dashboard/tenancies"
                  className="inline-flex items-center gap-2 rounded-sm bg-foreground px-4 py-2.5 font-[family-name:var(--font-inter)] text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
                >
                  View tenancies
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {/* ───────────── Recent batches ───────────── */}
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-4">
            <h2 className="font-headline text-lg font-light text-foreground sm:text-xl">
              Recent batches
            </h2>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>

          {history.length === 0 ? (
            <div className="border border-dashed border-border bg-card px-6 py-10 text-center">
              <p className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
                No batches yet · your first will appear here
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70 border border-border bg-card">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5"
                >
                  <div className="flex items-center gap-4">
                    <StatusIcon status={h.status} />
                    <div className="min-w-0">
                      <p className="font-[family-name:var(--font-inter)] text-sm font-semibold text-foreground">
                        {h.rowsSucceeded}/{h.rowsTotal} onboarded
                        {h.rowsFailed > 0 ? ` · ${h.rowsFailed} failed` : ""}
                      </p>
                      <p className="font-[family-name:var(--font-inter)] text-[11px] tracking-wide text-muted-foreground">
                        {h.createdAt ? new Date(h.createdAt).toLocaleString() : ""} · {h.kind}
                      </p>
                    </div>
                  </div>
                  <span className="font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    {h.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ───────────── Chat hint ───────────── */}
        <div className="border border-dashed border-border bg-muted/30 px-5 py-5 sm:px-8 sm:py-6 dark:bg-[#1F2020]/40">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background">
              <MessageSquare className="size-3.5 text-[#BD9952]" />
            </span>
            <div>
              <p className="font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Or use chat
              </p>
              <p className="mt-1 font-[family-name:var(--font-inter)] text-sm font-light text-foreground">
                Paste the same CSV into the assistant and say{" "}
                <span className="font-medium">&ldquo;onboard these tenants&rdquo;</span>. The CEO
                agent previews and onboards after you confirm.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Editorial number readout — Total / New / Matched ticker cells in the preview header. */
function Stat({
  label,
  value,
  accent,
  muted,
  danger,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <div>
      <p className="font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-headline text-2xl font-light tabular-nums",
          danger
            ? "text-destructive"
            : accent
              ? "text-[#BD9952]"
              : muted
                ? "text-muted-foreground"
                : "text-foreground",
        )}
      >
        {value.toLocaleString("en-GB")}
      </p>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed")
    return <CheckCircle2 className="size-4 text-[#7fc9b3] dark:text-[#afefdd]" />;
  if (status === "failed") return <XCircle className="size-4 text-destructive" />;
  if (status === "running") return <Loader2 className="size-4 animate-spin text-[#BD9952]" />;
  return <CheckCircle2 className="size-4 text-muted-foreground" />;
}
