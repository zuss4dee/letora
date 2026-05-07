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
    description: "Portfolio import reconciliation and row detail.",
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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#131313] px-6 py-10 text-[#e5e2e1]">
        <Link
          href="/dashboard/import"
          className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#888888] hover:text-white"
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
    headline = "Import completed successfully";
    sub = "Your portfolio records are up to date. Scan “Needs review” if any rows carried warnings.";
    bandClass = "border-[#afefdd]/30 bg-[#152420]";
  } else if (succeeded > 0 && failed > 0) {
    headline = "Import completed with partial failures";
    sub =
      "Some rows are live in Letora; others need a fix in your sheet. Use failed rows below, then re-import only what failed.";
    bandClass = "border-[#f8cf83]/35 bg-[#2a2210]";
  } else if (succeeded === 0 && failed > 0) {
    headline = "Import did not complete";
    sub = "No rows were written successfully. Correct validation errors, then run the import again.";
    bandClass = "border-[#BB5551]/35 bg-[#2a1514]";
  } else {
    headline = "Import finished";
    sub =
      "Rows may be skipped (inactive, duplicates, or property-only). Expand sections to reconcile each line.";
    bandClass = "border-[#333333] bg-[#1A1A1A]";
  }

  const model = reconcilePortfolioBatch(b.rows);

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
      />
    </>
  );
}
