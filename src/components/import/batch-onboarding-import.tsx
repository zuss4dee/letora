"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
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

type RunTotals = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  agentsTriggered: number;
  approvalsCreated: number;
};

type Tone = "error" | "skip" | "new" | "matched" | "ok";

function rowStatusLabel(row: PreparedRow): { label: string; tone: Tone } {
  if (row.tags.includes("validation_error")) return { label: "Fix row", tone: "error" };
  if (row.tags.includes("existing_active_tenancy_skip"))
    return { label: "Already onboarded", tone: "skip" };
  if (row.tags.includes("new_property")) return { label: "New property", tone: "new" };
  if (row.tags.includes("matched_property")) return { label: "Matched", tone: "matched" };
  return { label: "Ready", tone: "ok" };
}

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const map: Record<Tone, string> = {
    error: "border border-[#BB5551]/30 bg-[#7f2927]/20 text-[#ee7d77]",
    skip: "border border-[#333333] bg-[#1a1a1a] text-[#888888]",
    new: "border border-[#afefdd]/25 bg-[#1a2e28]/80 text-[#afefdd]",
    matched: "border border-[#4f3700]/40 bg-[#4f3700]/25 text-[#f8cf83]",
    ok: "border border-[#306f60]/30 bg-[#206153]/20 text-[#afefdd]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest",
        map[tone],
      )}
    >
      {label}
    </span>
  );
}

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
      <p className="text-[9px] uppercase tracking-widest text-[#888888]">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-xl font-semibold tabular-nums",
          danger
            ? "text-[#ee7d77]"
            : accent
              ? "text-[#f8cf83]"
              : muted
                ? "text-[#555555]"
                : "text-white",
        )}
      >
        {value.toLocaleString("en-GB")}
      </p>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="size-3.5 text-[#afefdd]" />;
  if (status === "failed") return <XCircle className="size-3.5 text-[#ee7d77]" />;
  if (status === "running") return <Loader2 className="size-3.5 animate-spin text-[#f8cf83]" />;
  return <CheckCircle2 className="size-3.5 text-[#555555]" />;
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
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (!dropped) return;
    setFile(dropped);
    setCsvText("");
    resetPreview();
  }

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
    <div className="flex min-h-0 flex-1 flex-col bg-[#131313] text-[#e5e2e1]">
      {/* ── Page Header ── */}
      <header className="border-b border-[#282828] bg-[#161616] px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#555555]">
          Import Console
        </p>
        <h1 className="mt-1 text-xl font-bold uppercase tracking-tight text-white">
          Portfolio Import
        </h1>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-[#555555]">
          Import Portfolio · Run agents at scale
        </p>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Left: Main Flow ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-px">

            {/* ── Step 01: Provide Portfolio ── */}
            <section className="border-b border-[#282828]">
              {/* Step header */}
              <div className="flex items-center justify-between border-b border-[#282828] bg-[#1A1A1A] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="bg-white px-1.5 py-0.5 font-mono text-[10px] font-black text-[#161616]">
                    01
                  </span>
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-white">
                    Provide your portfolio
                  </h2>
                </div>
                <a
                  href="/templates/tenant-batch-template.csv"
                  download
                  className="inline-flex items-center gap-1.5 border border-[#333333] bg-[#0B0B0B] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#888888] transition-colors hover:text-white"
                >
                  <Download className="size-3" />
                  Template
                </a>
              </div>

              {/* Upload + Paste grid */}
              <div className="grid grid-cols-1 gap-px bg-[#282828] sm:grid-cols-2">
                {/* Drop zone */}
                <label
                  htmlFor="batch-file"
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "group flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 px-6 text-center transition-colors",
                    isDragging
                      ? "border border-dashed border-white bg-[#1A1A1A]"
                      : file
                        ? "bg-[#152420]"
                        : "bg-[#131313] hover:bg-[#1A1A1A]",
                  )}
                >
                  <Upload
                    className={cn(
                      "size-6 transition-colors",
                      isDragging
                        ? "text-white"
                        : file
                          ? "text-[#afefdd]"
                          : "text-[#444748] group-hover:text-[#888888]",
                    )}
                  />
                  <span className="text-[11px] font-medium text-white">
                    {isDragging ? "Drop to upload" : file ? file.name : "Drop or choose a file"}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#444748]">
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
                <div className="flex flex-col gap-2 bg-[#131313] p-4">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="batch-csv"
                      className="text-[9px] font-bold uppercase tracking-widest text-[#555555]"
                    >
                      Or paste CSV
                    </label>
                    <span className="font-mono text-[9px] text-[#444748]">
                      detecting_headers...
                    </span>
                  </div>
                  <textarea
                    id="batch-csv"
                    placeholder={`property_address,city,tenant_name,tenant_email,monthly_rent,start_date\n12 Oak St,London,Alex Stone,alex@mail.com,1850,2026-05-01`}
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      if (e.target.value) setFile(null);
                      resetPreview();
                    }}
                    className="min-h-[164px] flex-1 resize-none border border-[#282828] bg-[#0B0B0B] p-3 font-mono text-[11px] leading-relaxed text-[#c4c7c8] placeholder-[#333333] focus:border-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Footer bar */}
              <div className="flex items-center justify-between border-t border-[#282828] bg-[#1A1A1A] px-4 py-3">
                <div className="flex items-center gap-4 text-[9px] uppercase tracking-widest text-[#555555]">
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
                      className="border border-[#333333] bg-[#0B0B0B] px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-[#888888] transition-colors hover:text-white"
                    >
                      Reset
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onPreview}
                    disabled={isPreviewing}
                    className="flex items-center gap-2 bg-white px-5 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#161616] transition-opacity hover:opacity-90 disabled:opacity-50"
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
                <div className="flex items-start gap-2 border-t border-[#BB5551]/30 bg-[#7f2927]/10 px-4 py-3">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#ee7d77]" />
                  <span className="text-[11px] text-[#ee7d77]">{error}</span>
                </div>
              ) : null}
            </section>

            {/* ── Step 02: Review Manifest ── */}
            {summary && rows ? (
              <section className="border-b border-[#282828]">
                {/* Step header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#282828] bg-[#1A1A1A] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-white px-1.5 py-0.5 font-mono text-[10px] font-black text-[#161616]">
                      02
                    </span>
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-white">
                      Review the manifest
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
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
                <ul className="divide-y divide-[#282828] sm:hidden">
                  {rows.map((row) => {
                    const status = rowStatusLabel(row);
                    return (
                      <li key={`m-${row.rowIndex}`} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-white">
                              {row.raw.propertyAddress || "—"}
                            </p>
                            <p className="truncate font-mono text-[10px] text-[#888888]">
                              {row.raw.tenantFullName || "—"} · {row.raw.tenantEmail || "—"}
                            </p>
                          </div>
                          <StatusPill label={status.label} tone={status.tone} />
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-[#282828] pt-2 font-mono text-[10px] text-[#888888]">
                          <span>{row.raw.monthlyRent > 0 ? `£${row.raw.monthlyRent.toLocaleString()}/mo` : "—"}</span>
                          <span>{row.raw.startDate || "—"}</span>
                        </div>
                        {row.raw.rowErrors.length > 0 || row.skipReason ? (
                          <p className="mt-1 font-mono text-[10px] text-[#ee7d77]">
                            {row.raw.rowErrors.length > 0 ? row.raw.rowErrors.join(", ") : row.skipReason}
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
                      <tr className="border-b border-[#282828] bg-[#161616] text-[9px] uppercase tracking-widest text-[#555555]">
                        {["#", "Status", "Property", "Tenant", "Rent", "Start", "Notes"].map((h) => (
                          <th key={h} className="px-4 py-2.5 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const status = rowStatusLabel(row);
                        return (
                          <tr
                            key={row.rowIndex}
                            className="border-b border-[#282828] align-top transition-colors hover:bg-[#1A1A1A]"
                          >
                            <td className="px-4 py-3 font-mono text-[10px] tabular-nums text-[#555555]">
                              {String(row.rowIndex + 1).padStart(2, "0")}
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill label={status.label} tone={status.tone} />
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[11px] font-medium text-white">
                                {row.raw.propertyAddress || "—"}
                              </p>
                              <p className="font-mono text-[10px] text-[#888888]">
                                {[row.raw.city, row.raw.postcode].filter(Boolean).join(", ") || "—"}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[11px] font-medium text-white">
                                {row.raw.tenantFullName || "—"}
                              </p>
                              <p className="truncate font-mono text-[10px] text-[#888888]">
                                {row.raw.tenantEmail || "—"}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-white">
                              {row.raw.monthlyRent > 0 ? `£${row.raw.monthlyRent.toLocaleString()}` : "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-[10px] tabular-nums text-[#888888]">
                              {row.raw.startDate || "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-[10px] text-[#888888]">
                              {row.raw.rowErrors.length > 0
                                ? row.raw.rowErrors.join(", ")
                                : (row.skipReason ?? "Ready")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Run footer */}
                <div className="flex flex-col gap-3 border-t border-[#282828] bg-[#1A1A1A] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[#555555]">
                    {summary.actionableRows} row{summary.actionableRows === 1 ? "" : "s"} ready ·
                    errors and duplicates skipped
                  </p>
                  <button
                    type="button"
                    onClick={onRun}
                    disabled={!canRun || isRunning}
                    className="flex items-center gap-2 bg-white px-6 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#161616] transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        Onboarding
                      </>
                    ) : (
                      <>Onboard {summary.actionableRows} row{summary.actionableRows === 1 ? "" : "s"}</>
                    )}
                  </button>
                </div>
              </section>
            ) : null}

            {/* ── Run Result ── */}
            {runTotals ? (
              <section className="animate-in fade-in zoom-in-95 duration-500 border border-[#afefdd]/30 bg-[#152420]">
                <div className="flex flex-col gap-8 px-6 py-8 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center bg-[#afefdd]/10">
                        <Sparkles className="size-5 text-[#afefdd]" />
                      </div>
                      <div>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#afefdd]">
                          Import Success
                        </p>
                        <h2 className="text-xl font-bold text-white">Portfolio Data Ingested</h2>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="font-mono text-sm text-white">
                        {runTotals.succeeded} units successfully onboarded · {runTotals.skipped} skipped
                      </p>
                      <p className="text-[13px] text-[#afefdd]/70">
                        Your agentic workforce has been dispatched to audit these records. 
                        They are currently processing leases and identifying compliance requirements.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-8 border-t border-[#afefdd]/10 pt-6">
                      <Stat label="Agents Dispatch" value={runTotals.agentsTriggered} accent={runTotals.agentsTriggered > 0} />
                      <Stat label="Pending Queue" value={runTotals.approvalsCreated} accent={runTotals.approvalsCreated > 0} />
                      {runTotals.failed > 0 && (
                        <Stat label="Manual Fixes" value={runTotals.failed} danger />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[200px]">
                    <Link
                      href="/dashboard"
                      className="flex items-center justify-center gap-2 bg-white px-6 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-black transition-all hover:bg-[#afefdd]"
                    >
                      Go to Command Center
                      <ChevronRight className="size-3" />
                    </Link>
                    <Link
                      href="/dashboard/activity"
                      className="flex items-center justify-center gap-2 border border-[#333333] bg-[#0B0B0B] px-6 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400 transition-colors hover:text-white"
                    >
                      Monitor Agents
                    </Link>
                  </div>
                </div>
              </section>
            ) : null}

            {/* ── Or Use Chat ── */}
            <section className="border-t border-[#282828] bg-[#0B0B0B] px-4 py-5">
              <div className="flex items-start gap-4">
                <div className="flex size-8 shrink-0 items-center justify-center border border-[#333333] bg-[#1A1A1A]">
                  <MessageSquare className="size-3.5 text-[#555555]" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#555555]">
                    Or use Chat
                  </p>
                  <p className="mt-1 text-[11px] text-[#888888]">
                    Paste the same CSV into the assistant and say{" "}
                    <span className="font-medium text-white">&ldquo;onboard these tenants&rdquo;</span>. The CEO agent
                    previews and onboards after you confirm.
                  </p>
                  <Link
                    href="/dashboard/assistant"
                    className="mt-3 inline-block border-b border-[#444748] pb-0.5 font-mono text-[9px] uppercase tracking-widest text-[#888888] transition-all hover:border-white hover:text-white"
                  >
                    Open Assistant
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <aside className="hidden w-72 shrink-0 flex-col border-l border-[#282828] lg:flex">
          {/* Recent Batches */}
          <div className="border-b border-[#282828] bg-[#1A1A1A] px-4 py-3">
            <h3 className="text-[9px] font-bold uppercase tracking-widest text-[#888888]">
              Recent Batches
            </h3>
          </div>

          {history.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 opacity-40">
              <div className="flex size-10 items-center justify-center border border-[#333333]">
                <Upload className="size-4 text-[#555555]" />
              </div>
              <p className="text-center font-mono text-[9px] uppercase tracking-widest text-[#555555]">
                No batches yet
              </p>
              <p className="text-center text-[9px] text-[#444748]">
                Completed imports and historical agent logs will appear here.
              </p>
            </div>
          ) : (
            <ul className="flex-1 divide-y divide-[#282828] overflow-y-auto">
              {history.map((h) => (
                <li key={h.id} className="px-4 py-3 hover:bg-[#1A1A1A]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={h.status} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-white">
                          {h.rowsSucceeded}/{h.rowsTotal} onboarded
                          {h.rowsFailed > 0 ? ` · ${h.rowsFailed} failed` : ""}
                        </p>
                        <p className="font-mono text-[9px] text-[#555555]">
                          {h.agentsTriggered} agents · {h.approvalsCreated} approvals
                        </p>
                        <p className="font-mono text-[9px] text-[#444748]">
                          {h.createdAt ? new Date(h.createdAt).toLocaleString() : ""} · {h.kind}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-[#555555]">
                      {h.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Import Guide */}
          <div className="border-t border-[#282828] bg-[#1A1A1A] p-4">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#555555]">
                Import Guide
              </p>
            </div>
            <ul className="space-y-2">
              {[
                "Understanding CSV field mapping",
                "Handling multi-unit properties",
                "Bulk tenant invite configuration",
              ].map((item) => (
                <li
                  key={item}
                  className="flex cursor-pointer items-center gap-2 text-[10px] text-[#555555] transition-colors hover:text-white"
                >
                  <span className="size-1 rounded-full bg-[#333333]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
