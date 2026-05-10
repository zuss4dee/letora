import Link from "next/link";

/**
 * Temporary scope banner when list pages are filtered to entities touched by a portfolio import batch.
 */
export function ImportBatchScopeChip({
  batchId,
  shortId,
  clearHref,
}: {
  batchId: string;
  shortId: string;
  /** Path without importBatch (and without other filters when possible). */
  clearHref: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-sm border border-emerald-200/90 bg-emerald-50 px-4 py-4 dark:border-[#306f60]/35 dark:bg-[#152420]/50 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800 dark:text-[#afefdd]">
          Imported in this batch
        </p>
        <p className="mt-1 text-sm leading-snug text-zinc-700 dark:text-[#e5e2e1]">
          Showing only records linked to import{" "}
          <span className="font-mono text-[11px] text-emerald-800 dark:text-[#afefdd]">{shortId}</span>. Clear the filter to see
          everything in this workspace.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          href={`/dashboard/import/batch/${batchId}`}
          className="inline-flex items-center justify-center border border-zinc-200 bg-white px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-800 transition-colors hover:border-zinc-400 hover:text-zinc-950 dark:border-[#333333] dark:bg-[#0B0B0B] dark:text-zinc-200 dark:hover:border-border dark:border-[#444444] dark:hover:text-white"
        >
          Batch results
        </Link>
        <Link
          href={clearHref}
          className="inline-flex items-center justify-center border border-border dark:border-[#afefdd]/40 bg-background dark:bg-[#afefdd] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#161616] transition-colors hover:bg-white"
        >
          Clear filter
        </Link>
      </div>
    </div>
  );
}
