import { loadCommandCenterAgentSummary } from "@/lib/dashboard/command-center-queries";
import { Activity, Mail, Sparkles, UserCheck } from "lucide-react";

export function CommandCenterAgentSummarySkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-4 w-32 bg-zinc-800 rounded" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-zinc-900 border border-[#333333]" />
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
        <h2 className="text-xs font-bold uppercase tracking-widest text-white">Agent Work Summary</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col border border-[#333333] bg-[#161616] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="size-3 text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Rent Drafts</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tabular-nums">{s.rentChaseDrafts}</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase text-zinc-600">
              Pending
              {s.rentChaseDrafts > 0 ? (
                <span className="size-2.5 shrink-0 rounded-full bg-red-500" aria-hidden />
              ) : null}
            </span>
          </div>
        </div>

        <div className="flex flex-col border border-[#333333] bg-[#161616] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-3 text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Maint Drafts</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tabular-nums">{s.maintenanceDrafts}</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase text-zinc-600">
              Pending
              {s.maintenanceDrafts > 0 ? (
                <span className="size-2.5 shrink-0 rounded-full bg-red-500" aria-hidden />
              ) : null}
            </span>
          </div>
        </div>

        <div className="flex flex-col border border-[#333333] bg-[#161616] p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="size-3 text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Total Tasks</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tabular-nums">{s.pendingApprovals}</span>
            <span className="font-mono text-[9px] uppercase text-zinc-600">Actions</span>
          </div>
        </div>

        <div className="flex flex-col border border-[#333333] bg-[#161616] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="size-3 text-zinc-500" aria-hidden />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Agents running</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tabular-nums">{activeAgents}</span>
            <span className="font-mono text-[9px] uppercase text-zinc-600">Queued · running</span>
          </div>
        </div>
      </div>
    </div>
  );
}
