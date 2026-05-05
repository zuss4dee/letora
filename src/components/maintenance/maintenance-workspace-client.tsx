"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Circle,
  Clock3,
  Search,
  SlidersHorizontal,
  SortAsc,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import type { AgentApprovalRow } from "@/lib/approvals/types";

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
  if (f === "resolved") return s === "resolved" || s === "completed";
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

function getAgentState(row: MaintenanceRequestRow, pendingApprovals: AgentApprovalRow[]) {
  const approval = pendingApprovals.find(a => a.target_id === row.id);
  if (approval) return { label: "DRAFT READY", tone: "emerald" as const, approvalId: approval.id, approval };
  const st = normalizeStatus(row.status);
  if (st === "resolved" || st === "completed") return { label: "RESOLVED", tone: "zinc" as const };
  if (row.contractorName) return { label: "DISPATCHED", tone: "blue" as const };
  return { label: "TRIAGED", tone: "zinc" as const };
}



type MaintenanceWorkspaceClientProps = {
  rows: MaintenanceRequestRow[];
  activeCount: number;
  pendingApprovals: AgentApprovalRow[];
  /**
   * When set, Maintenance Center MUST show this row, pin it in the roster (above filters/search),
   * and select it — only passes when the URL `issueId` validated against hydrated `rows`.
   */
  deeplinkIssueId?: string;
  /** URL had `issueId=` but it did not resolve into `rows` (invalid id / no access / empty session data). */
  issueDeeplinkMissing?: boolean;
  /** `tenantId` in URL is not on any of this landlord's tenancies — tenant filter ignored. */
  tenantScopeMissing?: boolean;
  /** Focal `issueId` row belongs to a different tenant than `tenantId` in the URL. */
  tenantIssueContextConflict?: boolean;
  /** Tenant filter matched no rows; list was widened (tenant filter dropped, property filter kept). */
  tenantScopeRosterFallback?: boolean;
};

export function MaintenanceWorkspaceClient({
  rows,
  activeCount,
  pendingApprovals,
  deeplinkIssueId,
  issueDeeplinkMissing,
  tenantScopeMissing,
  tenantIssueContextConflict,
  tenantScopeRosterFallback,
}: MaintenanceWorkspaceClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const id = deeplinkIssueId?.trim();
    return id && rows.some((r) => r.id === id) ? id : null;
  });
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("insights");

  const filteredSorted = useMemo(() => {
    const pinnedId = deeplinkIssueId?.trim() ?? "";
    const pinRow = pinnedId ? (rows.find((r) => r.id === pinnedId) ?? null) : null;

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

    /**
     * Deeplink / Command Center focal issue must stay in the visible list for this load
     * even when filters or search would ordinarily hide it (ops triage contract).
     */
    const listHasPin = pinRow != null && list.some((r) => r.id === pinRow.id);
    const merged =
      pinRow != null && !listHasPin ? [pinRow, ...list.filter((r) => r.id !== pinRow.id)] : [...list];

    const out = [...merged];
    if (sortMode === "newest") {
      out.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    } else if (sortMode === "oldest") {
      out.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    } else {
      out.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    }

    if (pinRow != null) {
      const rest = out.filter((r) => r.id !== pinRow.id);
      return [pinRow, ...rest];
    }
    return out;
  }, [rows, statusFilter, priorityFilter, search, sortMode, deeplinkIssueId]);

  useEffect(() => {
    const id = deeplinkIssueId?.trim();
    if (!id) return;
    if (!rows.some((r) => r.id === id)) return;
    setSelectedId(id);
    setInspectorTab("insights");
  }, [deeplinkIssueId, rows]);

  useLayoutEffect(() => {
    const id = deeplinkIssueId?.trim();
    if (!id || selectedId !== id) return;
    const safe =
      typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(id) : id;
    document.querySelector(`[data-maintenance-row="${safe}"]`)?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [deeplinkIssueId, selectedId, filteredSorted]);

  useEffect(() => {
    if (!selectedId) return;
    const pin = deeplinkIssueId?.trim();
    if (pin && selectedId === pin && rows.some((r) => r.id === pin)) {
      return;
    }
    if (!filteredSorted.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, filteredSorted, deeplinkIssueId, rows]);

  const selected =
    selectedId != null
      ? (filteredSorted.find((r) => r.id === selectedId) ??
          rows.find((r) => r.id === selectedId) ??
          null)
      : null;
  const inspectorOpen = selected != null;

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (priorityFilter !== "all" ? 1 : 0);

  return (
    <>
      {issueDeeplinkMissing ? (
        <div
          role="status"
          className="flex shrink-0 items-start gap-2 border-b border-amber-900/40 bg-amber-950/30 px-6 py-3 text-left"
        >
          <span className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Link
          </span>
          <p className="text-[11px] leading-relaxed text-amber-100/90">
            This maintenance reference is missing, inaccessible for your signed-in landlord account, or you
            are not signed in. The queue shows every issue you can operate from here.
          </p>
        </div>
      ) : null}
      {tenantIssueContextConflict ? (
        <div
          role="status"
          className="flex shrink-0 items-start gap-2 border-b border-orange-900/50 bg-orange-950/25 px-6 py-3 text-left"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-orange-400/90" aria-hidden />
          <div className="min-w-0 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-orange-300">
              Context
            </span>
            <p className="text-[11px] leading-relaxed text-orange-50/90">
              The deep-linked issue belongs to a different tenant than in the URL. The issue stays in
              focus below; tenant filter does not apply to that row.
            </p>
          </div>
        </div>
      ) : null}
      {tenantScopeMissing ? (
        <div
          role="status"
          className="flex shrink-0 items-start gap-2 border-b border-[#382f22] bg-[#1a1612] px-6 py-3 text-left"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500/90" aria-hidden />
          <div className="min-w-0 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-100/90">
              Tenant
            </span>
            <p className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.04em] text-zinc-500">
              No tenancy on your account matches this tenant id. Showing every maintenance issue you can
              access here (respecting property scope when set).
            </p>
          </div>
        </div>
      ) : null}
      {tenantScopeRosterFallback ? (
        <div
          role="status"
          className="flex shrink-0 items-start gap-2 border-b border-[#382f22] bg-[#1a1612] px-6 py-3 text-left"
        >
          <span className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
            Scope
          </span>
          <p className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.04em] text-zinc-500">
            Tenant filter matched no issues — widened to every issue for this property (or your portfolio
            when no property is set).
          </p>
        </div>
      ) : null}
      <div className="flex shrink-0 items-center justify-between border-b border-[#232323] bg-[#0e0e0e] px-6 py-4">
        <div>
          <h1 className="text-[16px] font-bold tracking-tight text-white uppercase">Maintenance Center</h1>
          <p className="text-[11px] text-zinc-500">Operational Issue Triage & Contractor Coordination</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full border border-[#232323] bg-[#080808] pl-8 pr-3 text-[11px] text-zinc-300 placeholder-zinc-600 focus:border-zinc-700 focus:outline-none transition-colors"
              placeholder="Search issues, properties..."
            />
          </div>
          <Button className="h-8 rounded-none bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-zinc-200">
            Log Issue
          </Button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-[#232323] bg-[#0B0B0B]">
        {[
          {
            label: "Open Issues",
            value: rows.filter((r) => {
              const s = normalizeStatus(r.status);
              return s !== "resolved" && s !== "completed";
            }).length,
          },
          { label: "Critical", value: rows.filter(r => toPriorityTone(r.priority) === 'critical').length, tone: 'rose' },
          { label: "Draft Ready", value: pendingApprovals.length, tone: 'emerald' },
          {
            label: "Resolved (30d)",
            value: rows.filter((r) => {
              const s = normalizeStatus(r.status);
              return s === "resolved" || s === "completed";
            }).length,
          },
        ].map((stat, i) => (
          <div key={i} className={cn(
            "flex flex-col border-r border-[#232323] p-4 last:border-r-0",
          )}>
            <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{stat.label}</span>
            <span className={cn(
              "text-xl font-bold tabular-nums",
              stat.tone === 'rose' && stat.value > 0 ? "text-rose-400" : 
              stat.tone === 'emerald' && stat.value > 0 ? "text-emerald-400" : "text-white"
            )}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col bg-[#1A1A1A]",
            inspectorOpen && "border-r border-[#282828]",
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#232323] bg-[#111111] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Filter Status</span>
              <div className="flex gap-1">
                {(['all', 'pending', 'in_progress', 'resolved'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
                      statusFilter === f ? "border-white/20 bg-white/10 text-white" : "border-[#232323] bg-transparent text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="h-auto w-auto gap-1.5 border-none bg-transparent p-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white focus:ring-0">
                  <span className="text-zinc-600">Sort:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#232323] bg-[#1A1A1A] text-zinc-100">
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <div className="sticky top-0 z-10 grid grid-cols-12 border-b border-[#232323] bg-[#111111] px-4 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              <div className="col-span-5">Issue & Property</div>
              <div className="col-span-2">Priority</div>
              <div className="col-span-3">Agent State</div>
              <div className="col-span-2 text-right">Age</div>
            </div>
            <div className="divide-y divide-[#232323]">
              {filteredSorted.map((row) => {
                const tone = toPriorityTone(row.priority);
                const isSelected = selectedId === row.id;
                const agentState = getAgentState(row, pendingApprovals);
                const isCritical = tone === 'critical';
                
                return (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    data-maintenance-row={row.id}
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
                      "grid cursor-pointer grid-cols-12 items-center gap-4 px-4 py-4 transition-colors hover:bg-[#161616]",
                      isSelected ? "bg-[#111111] shadow-[inset_2px_0_0_0_#ffffff]" : "bg-transparent"
                    )}
                  >
                    <div className="col-span-5 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-semibold text-zinc-100">{shortAddress(row.propertyAddress)}</span>
                        <span className="text-[10px] text-zinc-500 truncate">· {row.tenantFullName}</span>
                      </div>
                      <div className="mt-1 truncate text-[11px] text-zinc-400">
                        {row.description}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("size-1.5 rounded-full", priorityDotClass(tone))} />
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-wider",
                          isCritical ? "text-rose-400" : "text-zinc-500"
                        )}>
                          {tone}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className={cn(
                        "inline-block border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                        agentState.tone === 'emerald' ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                        agentState.tone === 'blue' ? "border-blue-500/30 bg-blue-500/10 text-blue-400" :
                        "border-[#333333] text-zinc-500"
                      )}>
                        {agentState.label}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-[10px] tabular-nums text-zinc-600">
                        {fmtDateTime(row.createdAt).split(',')[0]}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredSorted.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <p className="text-[11px] uppercase tracking-widest text-zinc-600">No issues matching filters</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {inspectorOpen && selected ? (
          <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden border-l border-[#232323] bg-[#0e0e0e]">
            <header className="flex shrink-0 items-center justify-between border-b border-[#232323] p-6">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Operational Detail
                </p>
                <h2 className="text-lg font-bold tracking-tight text-white uppercase">
                  ISSUE #{selected.id.slice(0, 4)}
                </h2>
              </div>
              <button
                type="button"
                className="text-zinc-500 transition-colors hover:text-white"
                onClick={() => setSelectedId(null)}
              >
                <X className="size-4" />
              </button>
            </header>

            <nav className="flex shrink-0 border-b border-[#232323] px-6" role="tablist">
              {(
                [
                  ["insights", "Triage"],
                  ["metadata", "Context"],
                  ["activity", "History"],
                ] as const
              ).map(([id, label]) => {
                const isActive = inspectorTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    onClick={() => setInspectorTab(id)}
                    className={cn(
                      "pb-4 pt-6 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors relative",
                      isActive
                        ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-white"
                        : "text-zinc-500 hover:text-zinc-200",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6">
              {inspectorTab === "insights" && (
                <>
                  <section>
                    <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Issue Summary</h3>
                    <div className="border border-[#232323] bg-[#0B0B0B] p-4 text-[12px] leading-relaxed text-zinc-300">
                      {selected.description}
                    </div>
                  </section>

                  {/* Agent Draft Preview */}
                  {getAgentState(selected, pendingApprovals).label === "DRAFT READY" && (
                    <section>
                      <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Contractor Outreach Draft</h3>
                      <div className="border border-emerald-900/30 bg-emerald-900/10 p-4 font-mono text-[11px]">
                        <div className="mb-3 border-b border-emerald-900/20 pb-3">
                          <span className="text-emerald-500/60 uppercase mr-2 text-[9px]">Subject:</span>
                          <span className="text-emerald-100">{(getAgentState(selected, pendingApprovals).approval?.payload?.emailSubject as string) ?? "—"}</span>
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed text-emerald-100/70">
                          {(getAgentState(selected, pendingApprovals).approval?.payload?.emailBody as string) ?? "No message body drafted."}
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}

              {inspectorTab === "metadata" && (
                <section>
                  <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Maintenance Context</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Category</p>
                        <p className="text-[11px] font-medium text-white">{assetGroupFromRow(selected)}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Priority</p>
                        <p className="text-[11px] font-medium text-white">{selected.priority ?? "—"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Contractor Assigned</p>
                      <p className="text-[11px] font-medium text-white">{selected.contractorName ?? "None Assigned"}</p>
                    </div>
                    {selected.propertyId && (
                      <Link
                        href={`/dashboard/properties/${selected.propertyId}`}
                        className="flex items-center justify-between border border-[#232323] px-3 py-2 text-[11px] text-zinc-400 hover:bg-[#1b1b1b] transition-colors"
                      >
                        <span>View Property Record</span>
                        <span className="text-white font-bold">VIEW</span>
                      </Link>
                    )}
                  </div>
                </section>
              )}

              {inspectorTab === "activity" && (
                <section>
                  <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">History</h3>
                  <div className="relative space-y-6 border-l border-[#232323] pl-4 ml-1">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 size-2 rounded-full bg-white" />
                      <p className="text-[11px] font-bold text-white uppercase">Issue Reported</p>
                      <p className="text-[10px] text-zinc-500">{fmtDateTime(selected.createdAt)}</p>
                    </div>
                    {selected.contractorName && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 size-2 rounded-full bg-zinc-600" />
                        <p className="text-[11px] font-bold text-zinc-300 uppercase">Contractor Logged</p>
                        <p className="text-[10px] text-zinc-500">{selected.contractorName}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="shrink-0 border-t border-[#232323] bg-[#0B0B0B] p-6">
              <div className="grid grid-cols-1 gap-2">
                {getAgentState(selected, pendingApprovals).label === "DRAFT READY" ? (
                  <Button
                    asChild
                    className="bg-emerald-600 py-6 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-emerald-700 transition-colors"
                  >
                    <Link href={`/dashboard/approvals?id=${getAgentState(selected, pendingApprovals).approvalId}`}>
                      Review & Approve Draft
                    </Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="bg-white py-6 text-[11px] font-bold uppercase tracking-[0.1em] text-black hover:bg-zinc-200 transition-colors"
                  >
                    <Link href={`/dashboard/maintenance/${selected.id}#assign-contractor`}>
                      Update Status
                    </Link>
                  </Button>
                )}
                <Button
                  asChild
                  variant="outline"
                  className="border-[#333333] bg-transparent py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400 hover:bg-zinc-900 transition-colors"
                >
                  <Link href={`/dashboard/maintenance/${selected.id}`}>
                    Open Full Case
                  </Link>
                </Button>
              </div>
            </div>
          </aside>
        ) : null}
      </main>
    </>
  );
}
