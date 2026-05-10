import { loadCommandCenterOnboardingBars } from "@/lib/dashboard/command-center-queries";

export function CommandCenterOnboardingTasksSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="size-1.5 bg-zinc-500" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Active Tasks</h2>
      </div>
      <div className="animate-pulse">
        <div className="h-28 border border-zinc-200 bg-white dark:border-[#2a2a2a] dark:bg-[#161616]" />
      </div>
    </div>
  );
}

export async function CommandCenterOnboardingTasks({ userId }: { userId: string }) {
  const bars = await loadCommandCenterOnboardingBars(userId);
  const meaningful = bars.filter((b) => b.pct > 0 && !b.label.startsWith("No active") && !b.label.startsWith("—"));

  const setupTasks = [
    { id: "s1", label: "System Readiness Check", pct: 100 },
    { id: "s2", label: "Agent Dispatch Queue", pct: 0 },
  ];

  const first = meaningful.slice(0, 2);
  const rows =
    first.length === 0
      ? setupTasks
      : first.length === 1
        ? [first[0]!, { id: "pad", label: "—", pct: 0 }]
        : [first[0]!, first[1]!];

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">
        <span className="size-1.5 shrink-0 bg-zinc-500" />
        Active Tasks
      </h2>
      <div className="border border-zinc-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#161616]">
        <p className="mb-3 text-[10px] font-bold uppercase text-zinc-500">Onboarding Funnel</p>
        <div className="space-y-3">
          {rows.map((b) => (
            <div key={b.id}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="truncate text-zinc-600 dark:text-zinc-400">{b.label}</span>
                <span className="shrink-0 pl-2 font-mono tabular-nums text-zinc-900 dark:text-white">{b.pct}%</span>
              </div>
              <div className="mt-1 h-1 w-full bg-zinc-200 dark:bg-[#282828]">
                <div className="h-full bg-zinc-100 dark:bg-zinc-900 dark:bg-white" style={{ width: `${Math.min(100, Math.max(0, b.pct))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
