"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background dark:bg-[#131313] px-6 py-16 text-center text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[38%] h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_50%_42%_at_50%_50%,rgba(226,226,226,0.06)_0%,transparent_62%)]" />
        <div className="absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle_at_center,rgba(100,118,132,0.04)_0%,transparent_58%)]" />
      </div>
      <div className="relative z-10 mx-auto max-w-md space-y-6">
        <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="font-headline text-2xl font-light tracking-[-0.03em] text-foreground md:text-3xl">
          We couldn&apos;t load this view.
        </h1>
        <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-muted-foreground">
          Try again, or head back to the app.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-w-[140px] items-center justify-center rounded-md bg-background dark:bg-[#E2E2E2] px-5 py-2.5 font-[family-name:var(--font-inter)] text-sm font-semibold text-[#131313] transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex min-w-[140px] items-center justify-center rounded-md border border-[rgb(72_72_72_/0.4)] bg-transparent px-5 py-2.5 font-[family-name:var(--font-inter)] text-sm font-medium text-foreground transition-colors hover:bg-background dark:bg-[#1b1b1b]"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
