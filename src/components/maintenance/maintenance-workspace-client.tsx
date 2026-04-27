"use client";

import Link from "next/link";
import {
  Bell,
  Circle,
  Clock3,
  Search,
  SlidersHorizontal,
  SortAsc,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { MaintenanceRequestRow } from "@/lib/actions/maintenance";
import { cn } from "@/lib/utils";

type PriorityTone = "critical" | "high" | "medium" | "low";

type StatusFilter = "all" | "pending" | "in_progress" | "scheduled" | "resolved";
type PriorityFilter = "all" | "critical" | "high" | "medium" | "low";
type SortMode = "newest" | "oldest" | "priority";
type InspectorTab = "insights" | "metadata" | "activity";

function toPriorityTone(priority: string | null): PriorityTone {
  const p = (priority ?? "").toLowerCase();
  if (p === "urgent" || p === "critical") return "critical";
  if (p === "high") return "high";
  if (p === "low") return "low";
  return "medium";
}

function priorityRank(priority: string | null): number {
  const t = toPriorityTone(priority);
  if (t === "critical") return 0;
  if (t === "high") return 1;
  if (t === "medium") return 2;
  return 3;
}

function normalizeStatus(status: string | null): string {
  return (status ?? "").toLowerCase();
}

function matchesStatusFilter(row: MaintenanceRequestRow, f: StatusFilter): boolean {
  if (f === "all") return true;
  const s = normalizeStatus(row.status);
  if (f === "pending") return s === "pending" || s === "open" || s === "";
  if (f === "in_progress") return s === "in_progress";
  if (f === "scheduled") return s === "scheduled";
  if (f === "resolved") return s === "resolved";
  return true;
}

function matchesPriorityFilter(row: MaintenanceRequestRow, f: PriorityFilter): boolean {
  if (f === "all") return true;
  return toPriorityTone(row.priority) === f;
}

function statusChip(status: string | null) {
  const s = normalizeStatus(status);
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
  const s = normalizeStatus(status);
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
  if (row.aiTriageSummary?.trim()) {
    return row.aiTriageSummary.trim();
  }
  if ((row.priority ?? "").toLowerCase() === "urgent" || (row.priority ?? "").toLowerCase() === "critical") {
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

function assetGroupFromRow(row: MaintenanceRequestRow | null): string {
  const c = row?.aiTriageCategory?.toLowerCase() ?? "";
  if (c.includes("plumb") || (row?.description ?? "").toLowerCase().includes("leak")) return "Plumbing";
  if (c.includes("heat") || (row?.description ?? "").toLowerCase().includes("radiator")) return "Heating";
  if (c.includes("electric")) return "Electrical";
  return row?.aiTriageCategory?.replace(/-/g, " ") || "General";
}

type MaintenanceWorkspaceClientProps = {
  rows: MaintenanceRequestRow[];
  activeCount: number;
};

export function MaintenanceWorkspaceClient({ rows, activeCount }: MaintenanceWorkspaceClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("insights");

  const filteredSorted = useMemo(() => {
    let list = rows.filter(
      (r) => matchesStatusFilter(r, statusFilter) && matchesPriorityFilter(r, priorityFilter),
    );
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.id,
          r.propertyAddress ?? "",
          r.description ?? "",
          r.tenantFullName ?? "",
          r.contractorName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const out = [...list];
    if (sortMode === "newest") {
      out.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    } else if (sortMode === "oldest") {
      out.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    } else {
      out.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    }
    return out;
  }, [rows, statusFilter, priorityFilter, search, sortMode]);

  useEffect(() => {
    if (selectedId && !filteredSorted.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, filteredSorted]);

  const selected = selectedId ? filteredSorted.find((r) => r.id === selectedId) ?? null : null;
  const inspectorOpen = selected != null;

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (priorityFilter !== "all" ? 1 : 0);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-10 shrink-0 items-center justify-between border-b border-[#282828] bg-[#0B0B0B] px-4">
        <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-white">
          Main Workspace
        </div>
        <div className="relative mx-6 w-full max-w-xl">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-full rounded-[2px] border border-[#333333] bg-[#161616] pl-8 pr-3 font-mono text-[12px] text-zinc-300 placeholder-zinc-600 focus:border-white focus:outline-none"
            placeholder="Jump to property, tenant or command..."
            aria-label="Search maintenance requests"
          />
        </div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Quick Action</div>
      </div>

      <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col bg-[#1A1A1A]",
            inspectorOpen && "border-r border-[#282828]",
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#282828] p-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold tracking-tight text-white">Maintenance Requests</h1>
              <span className="rounded-[2px] bg-[#282828] px-1.5 py-0.5 font-mono text-[9px] font-bold text-zinc-400">
                {activeCount} ACTIVE
              </span>
            </div>
            <div className="flex gap-2">
              <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 border border-[#333333] px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-[#242424] hover:text-white"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filter
                    {activeFilterCount > 0 ? (
                      <span className="ml-0.5 rounded bg-zinc-700 px-1 font-mono text-[9px] text-white">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="border-[#333] bg-[#161616] text-zinc-100">
                  <SheetHeader>
                    <SheetTitle className="text-white">Filters</SheetTitle>
                    <SheetDescription className="text-zinc-400">
                      Narrow the request list by status and priority.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 grid gap-6 px-4">
                    <div className="grid gap-2">
                      <Label className="text-zinc-400">Status</Label>
                      <Select
                        value={statusFilter}
                        onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                      >
                        <SelectTrigger className="border-[#333] bg-[#0B0B0B] text-zinc-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-[#333] bg-[#1A1A1A]">
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="pending">Pending / open</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-zinc-400">Priority</Label>
                      <Select
                        value={priorityFilter}
                        onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
                      >
                        <SelectTrigger className="border-[#333] bg-[#0B0B0B] text-zinc-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-[#333] bg-[#1A1A1A]">
                          <SelectItem value="all">All priorities</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <SheetFooter className="mt-8 border-t border-[#333] pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-[#444] bg-transparent text-zinc-200"
                      onClick={() => {
                        setStatusFilter("all");
                        setPriorityFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                    <Button
                      type="button"
                      className="bg-white text-zinc-950 hover:bg-zinc-200"
                      onClick={() => setFilterOpen(false)}
                    >
                      Apply
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="h-auto w-auto gap-1.5 border border-[#333333] bg-transparent px-2 py-1 font-mono text-[11px] text-zinc-400 hover:bg-[#242424] hover:text-white focus:ring-0">
                  <SortAsc className="h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#333] bg-[#1A1A1A] text-zinc-100">
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="priority">Priority (urgent first)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
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
                {filteredSorted.map((row) => {
                  const tone = toPriorityTone(row.priority);
                  const isSelected = selectedId === row.id;
                  return (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open request ${row.id.slice(0, 3)}`}
                      onClick={() => {
                        setSelectedId(row.id);
                        setInspectorTab("insights");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(row.id);
                          setInspectorTab("insights");
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-b border-[#282828] transition-colors hover:bg-[#242424] focus-visible:bg-[#242424] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                        isSelected && "bg-[#161616]/50",
                      )}
                    >
                      <td className="border-r border-[#282828] px-4 py-3 font-mono text-zinc-500">
                        #{row.id.slice(0, 3)}
                      </td>
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
                          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                            {tone}
                          </span>
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
                {filteredSorted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-500">
                      {rows.length === 0
                        ? "No maintenance requests found."
                        : "No requests match your filters or search."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {inspectorOpen && selected ? (
          <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden border-l border-[#282828] bg-[#161616]">
            <header className="flex shrink-0 items-center justify-between border-b border-[#282828] p-4">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Request
                </p>
                <h2 className="font-mono text-xl font-bold tracking-tight text-white">
                  #{selected.id.slice(0, 3)}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close panel"
                className="text-zinc-500 transition-colors hover:text-white"
                onClick={() => setSelectedId(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <nav className="flex shrink-0 border-b border-[#282828] px-4" role="tablist" aria-label="Request detail">
              {(
                [
                  ["insights", "AI Insights"],
                  ["metadata", "Metadata"],
                  ["activity", "Activity"],
                ] as const
              ).map(([id, label]) => {
                const isActive = inspectorTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setInspectorTab(id)}
                    className={cn(
                      "flex-1 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
                      isActive
                        ? "border-b-2 border-white text-white"
                        : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-200",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
              {inspectorTab === "insights" ? (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    <Zap className="h-3.5 w-3.5" />
                    AI Summary
                  </h3>
                  <div className="rounded-[2px] border border-[#282828] bg-[#1A1A1A] p-3">
                    <p className="font-mono text-[12px] leading-relaxed text-zinc-300">
                      {inspectorSummary(selected)}
                    </p>
                  </div>
                </section>
              ) : null}

              {inspectorTab === "metadata" ? (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    Metadata
                  </h3>
                  <div className="space-y-2.5 font-mono text-[11px]">
                    <div className="flex justify-between border-b border-[#282828] pb-1.5">
                      <span className="text-zinc-500">Created</span>
                      <span className="text-zinc-200">{fmtDateTime(selected.createdAt)}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#282828] pb-1.5">
                      <span className="text-zinc-500">Source</span>
                      <span className="uppercase text-zinc-200">Tenant App</span>
                    </div>
                    <div className="flex justify-between border-b border-[#282828] pb-1.5">
                      <span className="text-zinc-500">SLA Timer</span>
                      <span className="font-bold text-red-300">—</span>
                    </div>
                    <div className="flex justify-between border-b border-[#282828] pb-1.5">
                      <span className="text-zinc-500">Asset Group</span>
                      <span className="text-zinc-200">{assetGroupFromRow(selected)}</span>
                    </div>
                  </div>
                </section>
              ) : null}

              {inspectorTab === "activity" ? (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    <Bell className="h-3.5 w-3.5" />
                    Activity Log
                  </h3>
                  <div className="relative space-y-4 border-l border-[#282828] pl-5">
                    <div className="relative">
                      <Circle className="absolute -left-[22px] top-0.5 h-3.5 w-3.5 fill-[#161616] text-white" />
                      <p className="font-mono text-[11px] font-bold text-white">Request logged</p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {fmtDateTime(selected.createdAt)} · system
                      </p>
                    </div>
                    {selected.contractorName?.trim() ? (
                      <div className="relative">
                        <Circle className="absolute -left-[22px] top-0.5 h-3.5 w-3.5 fill-[#161616] text-zinc-600" />
                        <p className="font-mono text-[11px] font-bold text-zinc-300">Contractor assigned</p>
                        <p className="font-mono text-[10px] text-zinc-500">{selected.contractorName}</p>
                      </div>
                    ) : (
                      <p className="font-mono text-[11px] text-zinc-500">No further activity recorded yet.</p>
                    )}
                  </div>
                </section>
              ) : null}

              <div className="shrink-0 border-t border-[#282828] pt-4">
                <Button
                  asChild
                  className="mb-2 w-full rounded-[2px] bg-white py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-black hover:bg-zinc-200"
                >
                  <Link href={`/dashboard/maintenance/${selected.id}#assign-contractor`}>
                    Assign Contractor
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full rounded-[2px] border-[#333333] bg-transparent py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 hover:bg-[#242424] hover:text-white"
                >
                  <Link href={`/dashboard/maintenance/${selected.id}#request-issue`}>
                    Add Internal Note
                  </Link>
                </Button>
                <p className="mt-2 font-mono text-[9px] text-zinc-600">
                  Opens the full request page to assign a contractor or review the issue details.
                </p>
              </div>
            </div>
          </aside>
        ) : null}
      </main>
    </>
  );
}
