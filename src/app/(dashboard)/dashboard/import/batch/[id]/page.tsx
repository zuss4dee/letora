import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PortfolioImportBatchRunningRefreshGate } from "@/components/import/portfolio-import-batch-running-refresh";
import { PortfolioImportBatchReconciliation } from "@/components/import/portfolio-import-batch-reconciliation";
import { getBatchImportById } from "@/lib/actions/batch-onboarding";
import { reconcilePortfolioBatch } from "@/lib/onboarding/batch-import-reconciliation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Import batch ${id.slice(0, 8)} · Letora`,
    description: "See what saved, what to double-check, and what to fix after a portfolio upload.",
  };
}

export default async function PortfolioImportBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const loaded = await getBatchImportById(id);
  if (loaded.ok === false) {
    const msg = loaded.error;
    if (msg === "Batch not found." || msg === "Invalid batch id.") notFound();
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background px-6 py-10 text-zinc-950 dark:bg-[#131313] dark:text-[#e5e2e1]">
        <Link
          href="/dashboard/import"
          className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-900 dark:text-[#888888] dark:hover:text-white"
        >
          <ArrowLeft className="size-3" />
          Back to import
        </Link>
        <p className="text-sm text-[#ee7d77]">{msg}</p>
      </div>
    );
  }

  const b = loaded.batch;
  const succeeded = b.rowsSucceeded;
  const failed = b.rowsFailed;
  const skipped =
    b.rows.length > 0
      ? b.rows.filter((r) => r.outcome === "skipped").length
      : Math.max(0, b.rowsTotal - succeeded - failed);

  let headline: string;
  let sub: string;
  let bandClass: string;

  if (failed === 0 && succeeded > 0) {
    headline = "Import finished";
    sub = "Your changes are saved. Use quick checks below only if we flagged a row.";
    bandClass =
      "border-emerald-200/90 bg-emerald-50 dark:border-[#afefdd]/30 dark:bg-[#152420]";
  } else if (succeeded > 0 && failed > 0) {
    headline = "Some rows didn't save";
    sub = "Failed rows were not imported. Fix the file and import again.";
    bandClass =
      "border-amber-200/90 bg-amber-50 dark:border-[#f8cf83]/35 dark:bg-[#2a2210]";
  } else if (succeeded === 0 && failed > 0) {
    headline = "Nothing was saved";
    sub = "Failed rows were not imported. Fix the file and import again.";
    bandClass = "border-rose-200/90 bg-rose-50 dark:border-[#BB5551]/35 dark:bg-[#2a1514]";
  } else {
    headline = "Import finished";
    sub = "Skim the sections below if anything looks off.";
    bandClass = "border-zinc-200 bg-white dark:border-[#333333] dark:bg-[#1A1A1A]";
  }

  const model = reconcilePortfolioBatch(b.rows);
  const importSavedCleanly = failed === 0 && succeeded > 0;

  const failedOutcomes = b.rows.filter((r) => r.outcome === "error");
  const sr = b.sourceRows;
  const retryFailedAvailable =
    b.status !== "running" &&
    b.rowsFailed > 0 &&
    failedOutcomes.length > 0 &&
    sr != null &&
    sr.length > 0 &&
    failedOutcomes.every((r) => r.rowIndex >= 0 && r.rowIndex < sr.length);

  return (
    <>
      <PortfolioImportBatchRunningRefreshGate isRunning={b.status === "running"} />
      <PortfolioImportBatchReconciliation
        batchId={b.id}
        headline={headline}
        sub={sub}
        bandClass={bandClass}
        completedAt={b.completedAt}
        finalizeError={b.finalizeError ?? null}
        dbStatus={b.status}
        rowsTotal={b.rowsTotal}
        skippedCount={skipped}
        model={model}
        rawRows={b.rows}
        retryFailedAvailable={retryFailedAvailable}
        showPostImportNextSteps={importSavedCleanly}
      />
    </>
  );
}
