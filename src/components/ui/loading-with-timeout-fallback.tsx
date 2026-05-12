"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const TIMEOUT_MS = 10_000;

/**
 * Use as a Suspense fallback: shows `skeleton` until {@link TIMEOUT_MS}, then an error + refresh if still mounted (parent still suspended).
 */
export function LoadingWithTimeoutFallback({ skeleton }: { skeleton: ReactNode }) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (timedOut) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Something went wrong. Try refreshing.</p>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </div>
    );
  }

  return <>{skeleton}</>;
}
