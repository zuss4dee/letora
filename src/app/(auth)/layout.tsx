import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,theme(colors.zinc.300/.45)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.zinc.300/.45)_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(to_right,theme(colors.zinc.900/.65)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.zinc.900/.65)_1px,transparent_1px)]" />

      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] items-center justify-center p-6">
        <div className="relative flex min-h-[78vh] w-full items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_40px_90px_-45px_rgba(15,23,42,0.2)] transition-colors dark:border-zinc-800 dark:bg-zinc-900/60 dark:shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_40px_90px_-45px_rgba(0,0,0,0.75)]">
          <div className="absolute right-5 top-5">
            <ThemeToggle />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

