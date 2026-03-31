"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DASHBOARD_POLL_MS = 10_000;

let pollSubscribers = 0;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

function ensurePoll(router: { refresh: () => void }) {
  pollSubscribers += 1;
  if (pollIntervalId === null) {
    pollIntervalId = setInterval(() => {
      router.refresh();
    }, DASHBOARD_POLL_MS);
  }
  return () => {
    pollSubscribers -= 1;
    if (pollSubscribers <= 0 && pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
      pollSubscribers = 0;
    }
  };
}

/**
 * Periodically calls router.refresh() so server components re-fetch data
 * (e.g. after agent runs) without a full page reload.
 * Multiple callers on the same page share a single interval.
 */
export function useDashboardPollRefresh() {
  const router = useRouter();
  useEffect(() => {
    return ensurePoll(router);
  }, [router]);
}

/** Use on pages without a natural card host (e.g. maintenance list). Renders nothing. */
export function DashboardPollRefresh() {
  useDashboardPollRefresh();
  return null;
}
