"use client";

import type { BatchImportDetailRow } from "@/lib/actions/batch-onboarding";
import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import type { BatchReconciliationModel, SuspiciousFlag } from "@/lib/onboarding/batch-import-reconciliation";
import { rowKindNorm } from "@/lib/onboarding/batch-import-reconciliation";
import { cn } from "@/lib/utils";

function outcomeBadge(outcome: string): { label: string; className: string } {
  switch (outcome) {
    case "created":
    case "resumed":
      return { label: "Imported", className: "border-[#306f60]/40 bg-[#206153]/20 text-[#afefdd]" };
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
        ? "Review suggested"
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
      {(r.tenantFullName || r.tenantEmail) ? (
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

function ImportRowCard({ r }: { r: BatchImportDetailRow }) {
  return (
    <details className="group border-b border-[#282828] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-3 marker:content-none hover:bg-[#1A1A1A]/80 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tabular-nums text-zinc-500">#{r.line}</span>
            <p className="truncate text-sm font-medium text-zinc-100">{r.propertyAddress || "—"}</p>
          </div>
          <CompactRowPreview r={r} />
        </div>
        <ChevronDown className="mt-1 size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
      </summary>
      <RowDetailsBody r={r} />
    </details>
  );
}

function SectionBlock({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white">{title}</h3>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-zinc-500">{description}</p>
      </div>
      <div className="overflow-hidden rounded-sm border border-[#282828] bg-[#161616]">{children}</div>
    </section>
  );
}

function RowList({ rows, emptyLabel }: { rows: BatchImportDetailRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="px-3 py-8 text-center text-sm text-zinc-500">{emptyLabel}</p>;
  }
  return (
    <div>
      {rows.map((r) => (
        <ImportRowCard key={r.rowIndex} r={r} />
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
}) {
  const reviewIdx = useMemo(() => new Set(model.needsReview.map((r) => r.rowIndex)), [model.needsReview]);

  const cleanSuccessful = useMemo(
    () => model.successfulImports.filter((r) => !reviewIdx.has(r.rowIndex)),
    [model.successfulImports, reviewIdx],
  );

  const batchQ = `importBatch=${encodeURIComponent(batchId)}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const { hash } = window.location;
    if (hash === "#failed" || hash === "#import-section-failed") {
      window.requestAnimationFrame(() => {
        document.getElementById("import-section-failed")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  const propDisabled = model.filterSets.propertyIds.length === 0;
  const tenDisabled = model.filterSets.tenantIds.length === 0;
  const tencyDisabled = model.filterSets.tenancyIds.length === 0;

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
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#555555]">Reconcile import</p>
        <h1 className="mt-1 text-xl font-bold uppercase tracking-tight text-white">Import results</h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#555555]">{batchId}</p>
      </header>

      <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-8">
        <section className={cn("rounded-sm border px-5 py-6", bandClass)}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#888888]">Summary</p>
          <h2 className="mt-2 text-lg font-bold text-white sm:text-xl">{headline}</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#cfc9c4]">{sub}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#888888]">Properties</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
                {model.summary.propertiesCreated}
              </dd>
              <dd className="mt-1 text-[10px] text-zinc-500">Touched in this import</dd>
            </div>
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#888888]">Tenants</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
                {model.summary.tenantsCreated}
              </dd>
              <dd className="mt-1 text-[10px] text-zinc-500">Records linked</dd>
            </div>
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#888888]">Tenancies</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
                {model.summary.tenanciesCreated}
              </dd>
              <dd className="mt-1 text-[10px] text-zinc-500">Active records</dd>
            </div>
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#ee7d77]">Failed rows</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#ee7d77]">
                {model.summary.failedRows}
              </dd>
              <dd className="mt-1 text-[10px] text-zinc-500">Need correction & re-import</dd>
            </div>
            <div className="rounded-sm bg-black/20 px-3 py-3">
              <dt className="text-[9px] uppercase tracking-widest text-[#f8cf83]">Needs review</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#f8cf83]">
                {model.summary.warningsForReview}
              </dd>
              <dd className="mt-1 text-[10px] text-zinc-500">Warnings & duplicates</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] text-[#555555]">
            <span>Rows in file · {rowsTotal}</span>
            <span>Skipped · {skippedCount}</span>
            <span className="uppercase">DB · {dbStatus}</span>
          </div>

          {finalizeError ? (
            <p className="mt-4 max-w-2xl rounded-sm border border-[#BB5551]/35 bg-[#2a1514]/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-[#ee7d77]">
              Finalize diagnostic (DB): {finalizeError}
            </p>
          ) : null}

          {completedAt ? (
            <p className="mt-4 font-mono text-[10px] text-[#555555]">
              Completed · {new Date(completedAt).toLocaleString("en-GB")}
            </p>
          ) : null}
        </section>

        <section aria-label="Next actions">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white">Where to go next</h3>
          <p className="mb-4 max-w-2xl text-[12px] text-zinc-500">
            Open the workspace lists filtered to this import so you can see exactly what changed — without the noise of
            the full portfolio.
          </p>
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
              View imported properties
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
              View imported tenants
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
              View imported tenancies
            </Link>
            <Link
              href="#import-section-failed"
              className={cn(
                "inline-flex items-center justify-center gap-2 border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
                model.failed.length === 0
                  ? "pointer-events-none border-zinc-800 bg-zinc-900/40 text-zinc-600"
                  : "border-[#BB5551]/40 bg-[#2a1514]/50 text-[#ee7d77] hover:border-[#ee7d77]/50",
              )}
            >
              Review failed rows
            </Link>
          </div>
          {propDisabled && tenDisabled && tencyDisabled ? (
            <p className="mt-3 max-w-xl text-[11px] text-zinc-500">
              No property, tenant, or tenancy IDs were stamped on this batch snapshot (older import or property-only
              run). Use the row sections below for the audit trail.
            </p>
          ) : null}
        </section>

        {model.suspicious.length > 0 ? (
          <section className="space-y-2 rounded-sm border border-[#f8cf83]/25 bg-[#2a2210]/40 px-4 py-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#f8cf83]">Looks suspicious</h3>
            <p className="text-[12px] text-[#cfc9c4]">
              These patterns often mean duplicate spreadsheet lines or copy-paste issues. Compare rows before updating
              rent or legal records.
            </p>
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

        <div className="space-y-10">
          <SectionBlock
            title="Successful imports"
            description="Rows that completed without open warnings in this pass. Expand a row for full fields and IDs."
          >
            <RowList
              rows={cleanSuccessful}
              emptyLabel="No clean successes — check “Needs review” or “Failed rows”, or your rows were property-only."
            />
          </SectionBlock>

          <div id="import-section-failed">
            <SectionBlock
              title="Failed rows"
              description="These lines did not import. Fix the sheet or re-run a smaller batch after correcting validation."
            >
              <RowList rows={model.failed} emptyLabel="No failed rows in this batch." />
            </SectionBlock>
          </div>

          <SectionBlock
            title="Needs review"
            description="Warnings, compliance cues, or duplicate patterns — imported, but you should verify before relying on arrears or compliance workflows."
          >
            <RowList rows={model.needsReview} emptyLabel="Nothing flagged for review." />
          </SectionBlock>

          <SectionBlock
            title="Vacant · property-only"
            description="Property shells or vacant lines: useful for the portfolio map, not full tenancy workflows yet."
          >
            <RowList rows={model.vacantOrPropertyOnly} emptyLabel="No vacant or property-only lines." />
          </SectionBlock>
        </div>

        <details className="group rounded-sm border border-[#282828] bg-[#161616] px-4 py-3">
          <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Technical details & audit trail
            <span className="ml-2 text-zinc-600">({rawRows.length} rows)</span>
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
