import Link from "next/link";
import { AlertTriangle, ChevronRight, ShieldCheck, Wrench } from "lucide-react";

import { loadCommandCenterAttention } from "@/lib/dashboard/command-center-queries";
import { cn } from "@/lib/utils";

export function CommandCenterAttentionSkeleton() {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="size-1.5 bg-background dark:bg-[#ffb4ab]" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">What Needs Attention Now</h2>
      </div>
      <div className="animate-pulse border border-zinc-200 bg-white p-6 text-xs text-zinc-500 dark:border-[#2a2a2a] dark:bg-zinc-900">
        Loading…
      </div>
    </div>
  );
}

export async function CommandCenterAttention({ userId }: { userId: string }) {
  const rows = await loadCommandCenterAttention(userId);

  return (
    <div className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">
        <span className="size-1.5 shrink-0 bg-background dark:bg-[#ffb4ab]" />
        What Needs Attention Now
      </h2>
      <div className="divide-y divide-zinc-200 border border-zinc-200 bg-white dark:divide-[#282828] dark:border-[#2a2a2a] dark:bg-zinc-900">
        {rows.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-zinc-500">No urgent items — you&apos;re clear.</div>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              href={row.href}
              className="group flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-background dark:bg-[#242424]"
            >
              <div className="flex min-w-0 items-start gap-3">
                {row.tone === "danger" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#ffb4ab]" aria-hidden />
                ) : row.tone === "warning" ? (
                  <Wrench className="mt-0.5 size-4 shrink-0 text-zinc-400 dark:text-zinc-400" aria-hidden />
                ) : (
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-zinc-400 dark:text-zinc-400" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug text-zinc-900 dark:text-[#e5e2e1]">{row.title}</p>
                  <p className="mt-0.5 font-mono text-[11px] uppercase leading-tight text-zinc-500">{row.subline}</p>
                </div>
              </div>
              <ChevronRight
                className={cn("size-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-white")}
                aria-hidden
              />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
