import Link from "next/link";
import { loadCommandCenterActivity } from "@/lib/dashboard/command-center-queries";

export function CommandCenterActivitySkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="size-1.5 bg-zinc-300 dark:bg-zinc-600" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Recent Activity</h2>
      </div>
      <div className="animate-pulse border border-zinc-200 bg-white p-6 text-xs text-zinc-500 dark:border-[#2a2a2a] dark:bg-[#0B0B0B] dark:text-zinc-400">
        Loading…
      </div>
    </div>
  );
}

export async function CommandCenterActivity({ userId }: { userId: string }) {
  const rows = await loadCommandCenterActivity(userId);

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">
        <span className="size-1.5 shrink-0 bg-zinc-300 dark:bg-zinc-600" />
        Recent Activity
      </h2>
      <div className="border border-zinc-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#0B0B0B]">
        <div className="space-y-4">
          {rows.length === 0 ? (
            <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
              Standing by for agent dispatch...
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="relative pl-6">
                {/* Visual timeline elements */}
                <div className="absolute left-0 top-1.5 size-1.5 bg-zinc-300 dark:bg-zinc-600" />
                <div className="absolute left-[2.5px] top-[14px] h-[calc(100%-8px)] w-px bg-zinc-200 dark:bg-zinc-700" />

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] font-bold uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
                      {r.event}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                      Executed by: {r.source}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                    {r.time}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {rows.length > 0 && (
          <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-[#282828]">
            <Link
              href="/dashboard/activity"
              className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              View Full Audit Log →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
