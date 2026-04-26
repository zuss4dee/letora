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
      <div className="overflow-hidden border border-[#333333] bg-[#161616]">
        <div className="max-h-[400px] overflow-y-auto font-mono text-[11px] leading-tight">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#242424] uppercase text-zinc-500">
              <tr>
                <th className="p-2 font-semibold">Event</th>
                <th className="p-2 font-semibold">Source</th>
                <th className="p-2 text-right font-semibold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282828]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-zinc-500">
                    No recent activity logged.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-[#242424]">
                    <td className="p-2 text-zinc-300">{r.event}</td>
                    <td className="p-2 text-zinc-500">{r.source}</td>
                    <td className="p-2 text-right text-zinc-600">{r.time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
