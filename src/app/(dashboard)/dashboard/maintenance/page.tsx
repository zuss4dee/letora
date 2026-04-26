export const dynamic = "force-dynamic";

import { Suspense } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Circle,
  Clock3,
  Search,
  SlidersHorizontal,
  SortAsc,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import type { MaintenanceRequestRow } from "@/lib/actions/maintenance";
import { getMaintenanceRequests } from "@/lib/actions/maintenance";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type PriorityTone = "critical" | "high" | "medium" | "low";

function toPriorityTone(priority: string | null): PriorityTone {
  const p = (priority ?? "").toLowerCase();
  if (p === "urgent" || p === "critical") return "critical";
  if (p === "high") return "high";
  if (p === "low") return "low";
  return "medium";
}

function statusChip(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "in_progress") {
    return "bg-red-500/15 border-red-500/25 text-red-300";
  }
  if (s === "scheduled") {
    return "bg-zinc-700/50 border-zinc-600 text-zinc-300";
  }
  if (s === "resolved") {
    return "bg-emerald-500/15 border-emerald-500/25 text-emerald-300";
  }
  return "bg-zinc-700/50 border-zinc-600 text-zinc-300";
}

function statusLabel(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "in_progress") return "In Progress";
  if (s === "scheduled") return "Scheduled";
  if (s === "resolved") return "Completed";
  return "Pending";
}

function priorityDotClass(tone: PriorityTone) {
  if (tone === "critical") return "bg-red-400";
  if (tone === "high") return "bg-amber-400";
  if (tone === "medium") return "bg-blue-400";
  return "bg-zinc-500";
}

function inspectorSummary(row: MaintenanceRequestRow | null) {
  if (!row) return "No active request selected.";
  if ((row.priority ?? "").toLowerCase() === "urgent") {
    return "Historical reports suggest this may be linked to a recurring asset failure pattern. Prioritize root-cause inspection before cosmetic repair.";
  }
  if ((row.status ?? "").toLowerCase() === "in_progress") {
    return "Request is in active contractor workflow. Keep tenant updated and verify source condition before closure.";
  }
  return "Request has been triaged and can be sequenced in routine maintenance operations.";
}

function shortAddress(raw: string | null) {
  if (!raw) return "Property";
  return raw.split(",")[0]?.trim() || "Property";
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function MaintenanceWorkspaceSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const requests = userId ? await getMaintenanceRequests(userId) : { open: [], resolved: [] };

  const openSorted = [...requests.open].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const rows = [...openSorted, ...requests.resolved].slice(0, 20);
  const activeCount = requests.open.length;
  const selected = openSorted[0] ?? rows[0] ?? null;

  return (
    <main className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-[#1A1A1A]">
        <div className="flex items-center justify-between border-b border-[#282828] p-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight text-white">Maintenance Requests</h1>
            <span className="rounded-[2px] bg-[#282828] px-1.5 py-0.5 font-mono text-[9px] font-bold text-zinc-400">
              {activeCount} ACTIVE
            </span>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1.5 border border-[#333333] px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-[#242424] hover:text-white">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
            </button>
            <button className="inline-flex items-center gap-1.5 border border-[#333333] px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-[#242424] hover:text-white">
              <SortAsc className="h-3.5 w-3.5" />
              Sort
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-[#282828] bg-[#1A1A1A]">
              <tr className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                <th className="w-20 border-r border-[#282828] px-4 py-3">ID</th>
                <th className="border-r border-[#282828] px-4 py-3">Property</th>
                <th className="w-32 border-r border-[#282828] px-4 py-3">Status</th>
                <th className="w-28 border-r border-[#282828] px-4 py-3">Priority</th>
                <th className="w-32 px-4 py-3">Assignee</th>
              </tr>
            </thead>
            <tbody className="text-[12px] text-zinc-300">
              {rows.map((row) => {
                const tone = toPriorityTone(row.priority);
                const isSelected = selected?.id === row.id;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-[#282828] transition-colors hover:bg-[#242424]",
                      isSelected && "bg-[#161616]/50",
                    )}
                  >
                    <td className="border-r border-[#282828] px-4 py-3 font-mono text-zinc-500">#{row.id.slice(0, 3)}</td>
                    <td className="border-r border-[#282828] px-4 py-3">
                      <div className="font-semibold text-white">{shortAddress(row.propertyAddress)}</div>
                      <div className="font-mono text-[11px] text-zinc-500">
                        {row.description?.trim() || "No issue description"}
                      </div>
                    </td>
                    <td className="border-r border-[#282828] px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-[2px] border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em]",
                          statusChip(row.status),
                        )}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="border-r border-[#282828] px-4 py-3">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <span className={cn("h-1.5 w-1.5 rounded-full", priorityDotClass(tone))} />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">{tone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-zinc-700" />
                        <span className="text-[11px] font-medium">
                          {row.contractorName?.trim() || "Unassigned"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-500">
                    No maintenance requests found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="w-72 overflow-y-auto border-l border-[#282828] bg-[#161616]">
        <header className="flex items-center justify-between border-b border-[#282828] p-4">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">Request</p>
            <h2 className="font-mono text-xl font-bold tracking-tight text-white">#{selected?.id.slice(0, 3) ?? "—"}</h2>
          </div>
          <button className="text-zinc-500 transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex border-b border-[#282828] px-4">
          <button className="flex-1 border-b-2 border-white py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white">
            AI Insights
          </button>
          <button className="flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-200">
            Metadata
          </button>
          <button className="flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-200">
            Activity
          </button>
        </nav>

        <div className="space-y-6 p-4">
          <section>
            <h3 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              <Zap className="h-3.5 w-3.5" />
              AI Summary
            </h3>
            <div className="rounded-[2px] border border-[#282828] bg-[#1A1A1A] p-3">
              <p className="font-mono text-[12px] leading-relaxed text-zinc-300">{inspectorSummary(selected)}</p>
            </div>
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              <Clock3 className="h-3.5 w-3.5" />
              Metadata
            </h3>
            <div className="space-y-2.5 font-mono text-[11px]">
              <div className="flex justify-between border-b border-[#282828] pb-1.5"><span className="text-zinc-500">Created</span><span className="text-zinc-200">{fmtDateTime(selected?.createdAt ?? null)}</span></div>
              <div className="flex justify-between border-b border-[#282828] pb-1.5"><span className="text-zinc-500">Source</span><span className="uppercase text-zinc-200">Tenant App</span></div>
              <div className="flex justify-between border-b border-[#282828] pb-1.5"><span className="text-zinc-500">SLA Timer</span><span className="font-bold text-red-300">02:45:12</span></div>
              <div className="flex justify-between border-b border-[#282828] pb-1.5"><span className="text-zinc-500">Asset Group</span><span className="text-zinc-200">Plumbing</span></div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              <Bell className="h-3.5 w-3.5" />
              Activity Log
            </h3>
            <div className="relative space-y-4 border-l border-[#282828] pl-5">
              <div className="relative">
                <Circle className="absolute -left-[22px] top-0.5 h-3.5 w-3.5 fill-[#161616] text-white" />
                <p className="font-mono text-[11px] font-bold text-white">Status updated to In Progress</p>
                <p className="font-mono text-[10px] text-zinc-500">by {selected?.contractorName || "Agent"} • 14m ago</p>
              </div>
              <div className="relative">
                <Circle className="absolute -left-[22px] top-0.5 h-3.5 w-3.5 fill-[#161616] text-zinc-600" />
                <p className="font-mono text-[11px] font-bold text-zinc-300">Tenant uploaded photo</p>
                <p className="font-mono text-[10px] text-zinc-500">via portal • 1h ago</p>
              </div>
            </div>
          </section>

          <div className="pt-2">
            <button className="mb-2 w-full rounded-[2px] bg-white py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-black">
              Assign Contractor
            </button>
            <button className="w-full rounded-[2px] border border-[#333333] py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 transition-colors hover:bg-[#242424]">
              Add Internal Note
            </button>
          </div>
        </div>
      </aside>
    </main>
  );
}

function MaintenanceWorkspaceFallback() {
  return (
    <main className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-[#1A1A1A]">
        <div className="h-16 border-b border-[#282828] p-4" />
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-[2px] bg-[#242424]" />
          ))}
        </div>
      </section>
      <aside className="w-72 border-l border-[#282828] bg-[#161616] p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mb-3 h-12 animate-pulse rounded-[2px] bg-[#1f1f1f]" />
        ))}
      </aside>
    </main>
  );
}

export default function MaintenancePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DashboardPollRefresh />
      <div className="sticky top-0 z-30 flex h-10 items-center justify-between border-b border-[#282828] bg-[#0B0B0B] px-4">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white font-mono">Main Workspace</div>
        <div className="relative mx-6 w-full max-w-xl">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            className="h-7 w-full rounded-[2px] border border-[#333333] bg-[#161616] pl-8 pr-3 font-mono text-[12px] text-zinc-300 placeholder-zinc-600 focus:border-white focus:outline-none"
            placeholder="Jump to property, tenant or command..."
          />
        </div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Quick Action</div>
      </div>
      <Suspense fallback={<MaintenanceWorkspaceFallback />}>
        <MaintenanceWorkspaceSection />
      </Suspense>
    </div>
  );
}
