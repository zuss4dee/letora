import Link from "next/link";
import { loadCommandCenterActivity } from "@/lib/dashboard/command-center-queries";

export function CommandCenterActivitySkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="size-1.5 bg-white" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-white">Recent Activity</h2>
      </div>
      <div className="animate-pulse border border-[#333333] bg-[#161616] p-6 text-xs text-zinc-500">Loading…</div>
    </div>
  );
}

export async function CommandCenterActivity({ userId }: { userId: string }) {
  const rows = await loadCommandCenterActivity(userId);

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white">
        <span className="size-1.5 shrink-0 bg-white" />
        Recent Activity
      </h2>
      <div className="border border-[#333333] bg-[#161616] p-4">
        <div className="space-y-4">
          {rows.length === 0 ? (
            <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              Standing by for agent dispatch...
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="relative pl-6">
                {/* Visual timeline elements */}
                <div className="absolute left-0 top-1.5 size-1.5 bg-zinc-700" />
                <div className="absolute left-[2.5px] top-[14px] h-[calc(100%-8px)] w-px bg-zinc-800" />
                
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-tight text-white truncate">
                      {r.event}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                      Executed by: {r.source}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-zinc-600 tabular-nums">
                    {r.time}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        
        {rows.length > 0 && (
          <div className="mt-6 border-t border-[#282828] pt-4">
            <Link 
              href="/dashboard/activity" 
              className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
            >
              View Full Audit Log →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
