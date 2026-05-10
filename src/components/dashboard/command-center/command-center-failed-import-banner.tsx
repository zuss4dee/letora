"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useCallback, useState } from "react";

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
  const [dismissed, setDismissed] = useState(false);

  const onDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (failedCount <= 0 || dismissed) return null;

  const href = `/dashboard/import/batch/${encodeURIComponent(batchId)}#attention-failed`;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="relative mb-6 flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-4 pr-11 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6 dark:border-[#BB5551]/45 dark:bg-[#2a1514]/55 dark:shadow-none"
    >
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded border border-transparent p-1 text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-100/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-[#BB5551]/35 dark:hover:bg-black/20 dark:hover:text-white"
        aria-label="Dismiss import notice"
      >
        <X className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-['Inter',sans-serif] text-sm font-semibold text-red-900 dark:text-white">
          Recent import didn&apos;t finish cleanly
        </p>
        <p className="mt-1 text-[13px] leading-snug text-zinc-700 dark:text-zinc-400">
          Failed rows were not imported. Fix the file and import again.
        </p>
        <p className="mt-2 font-mono text-[11px] tabular-nums text-red-700 dark:text-[#ee7d77]">
          {`${failedCount} row${failedCount === 1 ? "" : "s"} didn't save`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <Link
          href={href}
          className="inline-flex items-center justify-center border border-red-700/25 bg-white px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-red-800 transition-colors hover:border-red-800 dark:border-[#ee7d77]/50 dark:bg-[#3a1614]/80 dark:text-[#fec8c5] dark:hover:border-[#ee7d77]"
        >
          Fix failed rows
        </Link>
        <Link
          href={`/dashboard/import/batch/${encodeURIComponent(batchId)}`}
          className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          View failed imports
        </Link>
      </div>
    </aside>
  );
}
