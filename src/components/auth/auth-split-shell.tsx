import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Shared input chrome for auth flows: ghost border, gold focus ring. */
export const authInputClassName =
  "h-11 rounded-md border border-[rgb(72_72_72_/0.28)] bg-[#0e0e0e]/85 px-4 text-foreground shadow-none placeholder:text-placeholder-foreground transition-colors focus-visible:border-[#BD9952]/45 focus-visible:ring-1 focus-visible:ring-[#BD9952]/25";

export const authPrimaryButtonClassName =
  "h-11 w-full rounded-md bg-[#BD9952] text-[13px] font-medium text-[#2c1e00] shadow-none transition-colors hover:bg-[#c9a660]";

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
      <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-[rgb(72_72_72_/0.14)] bg-[#131313]/45 shadow-[0_28px_90px_-48px_rgba(0,0,0,0.85)] backdrop-blur-[20px] lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex items-center justify-center px-6 py-12 md:px-10 md:py-14">{children}</section>
        <aside className="relative hidden min-h-0 overflow-hidden lg:block">{aside}</aside>
      </div>
    </main>
  );
}
