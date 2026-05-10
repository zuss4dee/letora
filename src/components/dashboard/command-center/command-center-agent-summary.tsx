import { loadCommandCenterAgentSummary } from "@/lib/dashboard/command-center-queries";
import { Activity, Mail, Sparkles, UserCheck } from "lucide-react";

export function CommandCenterAgentSummarySkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, idx) => (
          <div
            key={`agent-summary-tile-${idx}`}
            className="h-20 rounded-sm bg-zinc-100 md:border md:border-zinc-200 dark:bg-zinc-900 md:dark:border-[#2a2a2a]"
          />
        ))}
      </div>
    </div>
  );
}

export async function CommandCenterAgentSummary({ userId }: { userId: string }) {
  const s = await loadCommandCenterAgentSummary(userId);
  const activeAgents =
    typeof s.activeAgents === "number" && Number.isFinite(s.activeAgents) ? s.activeAgents : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="size-1.5 bg-[#afefdd]" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Agent Work Summary</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col border border-zinc-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#161616]">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="size-3 text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Rent Drafts</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-white">{s.rentChaseDrafts}</span>
            <span className="font-mono text-[9px] uppercase text-zinc-600">Pending</span>
          </div>
        </div>

        <div className="flex flex-col border border-zinc-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#161616]">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-3 text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Maint Drafts</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-white">{s.maintenanceDrafts}</span>
            <span className="font-mono text-[9px] uppercase text-zinc-600">Pending</span>
          </div>
        </div>

        <div className="flex flex-col border border-zinc-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#161616]">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="size-3 text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Total Tasks</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-white">{s.pendingApprovals}</span>
            <span className="font-mono text-[9px] uppercase text-zinc-600">Actions</span>
          </div>
        </div>

        <div className="flex flex-col border border-zinc-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#161616]">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="size-3 text-zinc-500" aria-hidden />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Agents running</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-white">{activeAgents}</span>
            <span className="font-mono text-[9px] uppercase text-zinc-600">Queued · running</span>
          </div>
        </div>
      </div>
    </div>
  );
}
