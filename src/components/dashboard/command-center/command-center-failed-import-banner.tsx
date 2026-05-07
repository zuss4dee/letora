import Link from "next/link";

/**
 * Highlights the most recent import batch that still has failed rows (server provides id + counts).
 */
export function CommandCenterFailedImportBanner({
  batchId,
  failedCount,
}: {
  batchId: string;
  failedCount: number;
}) {
  if (failedCount <= 0) return null;

  const href = `/dashboard/import/batch/${encodeURIComponent(batchId)}#attention-failed`;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="mb-6 flex flex-col gap-3 rounded-md border border-[#BB5551]/45 bg-[#2a1514]/55 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="min-w-0 flex-1">
        <p className="font-['Inter',sans-serif] text-sm font-semibold text-white">
          Recent import didn&apos;t finish cleanly
        </p>
        <p className="mt-1 text-[13px] leading-snug text-zinc-400">
          Failed rows were not imported. Fix the file and import again.
        </p>
        <p className="mt-2 font-mono text-[11px] tabular-nums text-[#ee7d77]">
          {`${failedCount} row${failedCount === 1 ? "" : "s"} didn't save`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <Link
          href={href}
          className="inline-flex items-center justify-center border border-[#ee7d77]/50 bg-[#3a1614]/80 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#fec8c5] transition-colors hover:border-[#ee7d77]"
        >
          Fix failed rows
        </Link>
        <Link
          href={`/dashboard/import/batch/${encodeURIComponent(batchId)}`}
          className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
        >
          View failed imports
        </Link>
      </div>
    </aside>
  );
}
