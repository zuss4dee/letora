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
    <div className="mb-6 flex flex-col gap-3 rounded-sm border border-[#306f60]/35 bg-[#152420]/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#afefdd]">
          Imported in this batch
        </p>
        <p className="mt-1 text-sm leading-snug text-[#e5e2e1]">
          Showing only records linked to import{" "}
          <span className="font-mono text-[11px] text-[#afefdd]">{shortId}</span>. Clear the filter to see
          everything in this workspace.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          href={`/dashboard/import/batch/${batchId}`}
          className="inline-flex items-center justify-center border border-[#333333] bg-[#0B0B0B] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-200 transition-colors hover:border-[#444444] hover:text-white"
        >
          Batch results
        </Link>
        <Link
          href={clearHref}
          className="inline-flex items-center justify-center border border-[#afefdd]/40 bg-[#afefdd] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#161616] transition-colors hover:bg-white"
        >
          Clear filter
        </Link>
      </div>
    </div>
  );
}
