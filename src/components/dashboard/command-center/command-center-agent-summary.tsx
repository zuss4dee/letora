import { loadCommandCenterAgentSummary } from "@/lib/dashboard/command-center-queries";
import { ClipboardList, Loader2, Mail, Sparkles, UserCheck } from "lucide-react";

export function CommandCenterAgentSummarySkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-4 w-32 bg-zinc-800 rounded" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-20 bg-zinc-900 border border-[#333333] ${i === 4 ? "col-span-2" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

export async function CommandCenterAgentSummary({ userId }: { userId: string }) {
  const s = await loadCommandCenterAgentSummary(userId);

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
            <span className="font-mono text-[9px] uppercase text-zinc-600">Pending</span>
          </div>
        </div>

        <div className="flex flex-col border border-[#333333] bg-[#161616] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-3 text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Maint Drafts</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tabular-nums">{s.maintenanceDrafts}</span>
            <span className="font-mono text-[9px] uppercase text-zinc-600">Pending</span>
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
            <Loader2 className="size-3 text-[#afefdd] animate-spin" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Agents running</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#afefdd] tabular-nums">{s.activeAgents}</span>
            <span className="font-mono text-[9px] uppercase text-zinc-600">Queued · running</span>
          </div>
        </div>

        <div className="col-span-2 flex flex-col border border-[#333333] bg-[#161616] p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="size-3 text-zinc-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Awaiting approval</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tabular-nums">{s.awaitingApprovalAgentRuns}</span>
            <span className="font-mono text-[9px] uppercase text-zinc-600">Runs on hold</span>
          </div>
        </div>
      </div>
    </div>
  );
}
