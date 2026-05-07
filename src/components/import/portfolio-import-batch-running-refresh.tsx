"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Batch result is a server-rendered page — if `batch_imports.status` was still `running` when the
 * user landed here, automatically revalidate so the banner/counters move to a terminal state once
 * the finalize write lands.
 */
export function PortfolioImportBatchRunningRefreshGate({ isRunning }: { isRunning: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!isRunning) return;
    let tick = 0;
    const id = window.setInterval(() => {
      tick += 1;
      /** `router.refresh` can reuse a cached RSC payload; hard reload escapes that when stuck. */
      if (tick % 10 === 0) window.location.reload();
      else router.refresh();
    }, 2600);
    return () => window.clearInterval(id);
  }, [isRunning, router]);

  return null;
}
