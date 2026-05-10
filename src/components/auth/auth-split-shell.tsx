import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Shared input chrome for auth flows: theme-aware surface, neutral focus ring. */
export const authInputClassName =
  "h-11 rounded-md border border-border bg-background px-4 text-foreground shadow-none placeholder:text-muted-foreground/35 transition-colors focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/25 dark:border-[rgb(72_72_72_/0.28)] dark:bg-[#0e0e0e]/85 dark:placeholder:text-zinc-500/45 dark:focus-visible:border-white dark:focus-visible:ring-white/20";

export const authPrimaryButtonClassName =
  "h-11 w-full rounded-md bg-zinc-100 dark:bg-zinc-900 text-[13px] font-medium text-white shadow-none transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200";

/**
 * Split card: form + editorial aside (hidden on small screens).
 */
export function AuthSplitShell({
  children,
  aside,
  className,
}: {
  children: ReactNode;
  aside: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("w-full max-w-[1080px] font-normal", className)}>
      <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-border bg-card/90 shadow-[0_28px_90px_-48px_rgba(0,0,0,0.12)] backdrop-blur-[20px] dark:border-[rgb(72_72_72_/0.14)] dark:bg-[#131313]/45 dark:shadow-[0_28px_90px_-48px_rgba(0,0,0,0.85)] lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex items-center justify-center px-6 py-12 md:px-10 md:py-14">{children}</section>
        <aside className="relative hidden min-h-0 overflow-hidden lg:block">{aside}</aside>
      </div>
    </main>
  );
}
