"use client";

/* eslint-disable @typescript-eslint/no-unused-vars -- legacy ops shell: unused icons/helpers reserved for future controls */
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Circle,
  Clock3,
  Search,
  SlidersHorizontal,
  SortAsc,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import type { AgentApprovalRow } from "@/lib/approvals/types";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { AddRequestDialog } from "@/components/maintenance/add-request-dialog";
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
    return "border border-red-200 bg-red-50 text-red-800 dark:bg-red-500/15 dark:border-red-500/25 dark:text-red-300";
  }
  if (s === "scheduled") {
    return "border border-zinc-300 bg-zinc-100 text-zinc-700 dark:bg-zinc-700/50 dark:border-zinc-600 dark:text-zinc-300";
  }
  if (s === "resolved") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/25 dark:text-emerald-300";
  }
  return "border border-zinc-300 bg-zinc-100 text-zinc-700 dark:bg-zinc-700/50 dark:border-zinc-600 dark:text-zinc-300";
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
  /** Tenant options for raising a maintenance request */
  tenancyDialogOptions: Array<{ id: string; label: string }>;
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
  tenancyDialogOptions,
}: MaintenanceWorkspaceClientProps) {
  void activeCount;
  const [addRequestOpen, setAddRequestOpen] = useState(false);
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

  /* eslint-disable react-hooks/set-state-in-effect -- sync list selection to URL deeplink and filtered roster */
  useEffect(() => {
    const id = deeplinkIssueId?.trim();
    if (!id) return;
    if (!rows.some((r) => r.id === id)) return;
    setSelectedId(id);
    setInspectorTab("insights");
  }, [deeplinkIssueId, rows]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  /* eslint-disable react-hooks/set-state-in-effect -- clear selection when row drops out of filtered list */
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
  /* eslint-enable react-hooks/set-state-in-effect */

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
          className="flex shrink-0 items-start gap-2 border-b border-amber-200/90 bg-amber-50 px-6 py-3 text-left dark:border-[#382f22] dark:bg-[#1a1612]"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500/90" aria-hidden />
          <div className="min-w-0 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-100/90">
              Tenant
            </span>
            <p className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.04em] text-zinc-600 dark:text-zinc-500">
              No tenancy on your account matches this tenant id. Showing every maintenance issue you can
              access here (respecting property scope when set).
            </p>
          </div>
        </div>
      ) : null}
      {tenantScopeRosterFallback ? (
        <div
          role="status"
          className="flex shrink-0 items-start gap-2 border-b border-amber-200/90 bg-amber-50 px-6 py-3 text-left dark:border-[#382f22] dark:bg-[#1a1612]"
        >
          <span className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
            Scope
          </span>
          <p className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.04em] text-zinc-600 dark:text-zinc-500">
            Tenant filter matched no issues — widened to every issue for this property (or your portfolio
            when no property is set).
          </p>
        </div>
      ) : null}
      <div className="flex shrink-0 flex-col gap-3 border-b border-zinc-200/80 bg-white px-4 py-4 dark:border-[#232323] dark:bg-[#0e0e0e] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-zinc-900 md:text-2xl dark:text-white">
            Maintenance Center
          </h1>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-500">
            Operational Issue Triage & Contractor Coordination
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AddRequestDialog
            tenancies={tenancyDialogOptions}
            open={addRequestOpen}
            onOpenChange={setAddRequestOpen}
          />
          <div className="relative hidden min-w-0 flex-1 sm:block sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 dark:text-zinc-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full border border-zinc-200/90 bg-white pl-8 pr-3 text-[11px] text-zinc-900 placeholder:text-zinc-500 transition-colors focus:border-zinc-300 focus:outline-none dark:border-[#232323] dark:bg-[#080808] dark:text-zinc-300 dark:placeholder-zinc-600 dark:focus:border-zinc-700"
              placeholder="Search issues, properties..."
            />
          </div>
          <Button
            type="button"
            onClick={() => setAddRequestOpen(true)}
            disabled={tenancyDialogOptions.length === 0}
            className="h-9 w-full rounded-md border border-zinc-200 bg-zinc-900 px-4 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 sm:h-8 sm:w-auto dark:border-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Log Issue
          </Button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-zinc-200/80 bg-zinc-200 dark:border-[#232323] dark:bg-[#282828] lg:grid-cols-4">
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
            "flex min-h-[88px] flex-col border-r border-zinc-200/80 bg-white p-4 last:border-r-0 dark:border-r-[#232323] dark:bg-[#0B0B0B]",
          )}>
            <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{stat.label}</span>
            <span
              className={cn(
                "text-2xl font-bold tabular-nums md:text-3xl",
                stat.tone === "rose" && stat.value > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : stat.tone === "emerald" && stat.value > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-900 dark:text-white",
              )}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-[#1A1A1A]",
            inspectorOpen && "border-r border-zinc-200/80 dark:border-[#282828]",
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 bg-zinc-50 px-4 py-3 dark:border-[#232323] dark:bg-[#111111]">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Filter Status</span>
              <div className="flex gap-1">
                {(['all', 'pending', 'in_progress', 'resolved'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
                      statusFilter === f ? "border-zinc-900/25 bg-zinc-100 dark:bg-zinc-900/10 text-zinc-900 dark:border-white/20 dark:bg-white/10 dark:text-white" : "border-zinc-200/90 bg-transparent text-zinc-600 hover:text-zinc-900 dark:border-[#232323] dark:text-zinc-500 dark:hover:text-zinc-300"
                    )}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="h-auto w-auto gap-1.5 border-none bg-transparent p-0 text-[10px] font-bold uppercase tracking-wider text-zinc-600 hover:text-zinc-900 focus:ring-0 dark:text-zinc-500 dark:hover:text-white">
                  <span className="text-zinc-600">Sort:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-[#232323] dark:bg-[#1A1A1A] dark:text-zinc-100">
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <div className="sticky top-0 z-10 grid min-w-[640px] grid-cols-12 border-b border-zinc-200/80 bg-zinc-50 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:border-[#232323] dark:bg-[#111111] dark:text-zinc-400">
              <div className="col-span-5">Issue & Property</div>
              <div className="hidden col-span-2 md:block">Priority</div>
              <div className="hidden col-span-3 md:block">Agent State</div>
              <div className="col-span-7 text-right md:col-span-2">Age</div>
            </div>
            <div className="min-w-[640px] divide-y divide-zinc-200/80 dark:divide-[#232323]">
              {rows.length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="No maintenance requests"
                  description="Tenant maintenance requests will appear here."
                  actionLabel="Log Request"
                  onAction={() => setAddRequestOpen(true)}
                  className="min-h-[14rem]"
                />
              ) : (
                <>
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
                      "grid cursor-pointer grid-cols-12 items-center gap-4 px-4 py-4 transition-colors hover:bg-zinc-100 dark:hover:bg-background dark:bg-[#161616]",
                      isSelected ? "bg-zinc-100 shadow-[inset_2px_0_0_0_#18181b] dark:bg-[#111111] dark:shadow-[inset_2px_0_0_0_#ffffff]" : "bg-transparent"
                    )}
                  >
                    <div className="col-span-5 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">{shortAddress(row.propertyAddress)}</span>
                        <span className="text-[10px] text-zinc-500 truncate">· {row.tenantFullName}</span>
                      </div>
                      <div className="mt-1 truncate text-[11px] text-zinc-600 dark:text-zinc-500">
                        {row.description}
                      </div>
                    </div>
                    <div className="hidden col-span-2 md:block">
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
                    <div className="hidden col-span-3 md:block">
                      <span className={cn(
                        "inline-block border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                        agentState.tone === 'emerald' ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                        agentState.tone === 'blue' ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400" :
                        "border-zinc-200 text-zinc-700 dark:border-[#333333] dark:text-zinc-500"
                      )}>
                        {agentState.label}
                      </span>
                    </div>
                    <div className="col-span-7 text-right md:col-span-2">
                      <span className="text-[10px] tabular-nums text-zinc-700 dark:text-zinc-600">
                        {fmtDateTime(row.createdAt).split(',')[0]}
                      </span>
                    </div>
                  </div>
                );
                  })}
                  {filteredSorted.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-[11px] uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                    No issues matching filters
                  </p>
                </div>
                  ) : null}
                </>
              )}
            </div>
            <p className="border-t border-zinc-200/80 px-4 py-1 text-xs text-zinc-400 dark:border-[#282828] md:hidden">
              ← Scroll to see more
            </p>
          </div>
        </section>

        {inspectorOpen && selected ? (
          <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden border-l border-zinc-200/80 bg-white dark:border-[#232323] dark:bg-[#0e0e0e]">
            <header className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 p-6 dark:border-[#232323]">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Operational Detail
                </p>
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 uppercase dark:text-white">
                  ISSUE #{selected.id.slice(0, 4)}
                </h2>
              </div>
              <button
                type="button"
                className="text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
                onClick={() => setSelectedId(null)}
              >
                <X className="size-4" />
              </button>
            </header>

            <nav className="flex shrink-0 border-b border-zinc-200/80 px-6 dark:border-[#232323]" role="tablist">
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
                        ? "text-zinc-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:after:bg-white"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200",
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
                    <div className="border border-zinc-200/80 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-700 dark:border-[#232323] dark:bg-[#0B0B0B] dark:text-zinc-300">
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
                        <p className="text-[11px] font-medium text-zinc-900 dark:text-white">{assetGroupFromRow(selected)}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Priority</p>
                        <p className="text-[11px] font-medium text-zinc-900 dark:text-white">{selected.priority ?? "—"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Contractor Assigned</p>
                      <p className="text-[11px] font-medium text-zinc-900 dark:text-white">{selected.contractorName ?? "None Assigned"}</p>
                    </div>
                    {selected.propertyId && (
                      <Link
                        href={`/dashboard/properties/${selected.propertyId}`}
                        className="flex items-center justify-between border border-zinc-200/90 px-3 py-2 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-[#232323] dark:text-zinc-400 dark:hover:bg-background dark:bg-[#1b1b1b]"
                      >
                        <span>View Property Record</span>
                        <span className="font-bold text-zinc-900 dark:text-white">VIEW</span>
                      </Link>
                    )}
                  </div>
                </section>
              )}

              {inspectorTab === "activity" && (
                <section>
                  <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">History</h3>
                  <div className="relative space-y-6 border-l border-zinc-200 pl-4 ml-1 dark:border-[#232323]">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 size-2 rounded-full bg-zinc-100 dark:bg-zinc-900 dark:bg-white" />
                      <p className="text-[11px] font-bold text-zinc-900 uppercase dark:text-white">Issue Reported</p>
                      <p className="text-[10px] text-zinc-500">{fmtDateTime(selected.createdAt)}</p>
                    </div>
                    {selected.contractorName && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 size-2 rounded-full bg-zinc-600" />
                        <p className="text-[11px] font-bold uppercase text-zinc-800 dark:text-zinc-300">Contractor Logged</p>
                        <p className="text-[10px] text-zinc-500">{selected.contractorName}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="shrink-0 border-t border-zinc-200/80 bg-zinc-50 p-6 dark:border-[#232323] dark:bg-[#0B0B0B]">
              <div className="grid grid-cols-1 gap-2">
                {getAgentState(selected, pendingApprovals).label === "DRAFT READY" ? (
                  <Button
                    asChild
                    className="border border-transparent bg-green-600 py-6 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-green-700 dark:border-[#9ad7c3]/20 dark:bg-[#152420] dark:text-[#9ad7c3] dark:hover:bg-[#1a2e29]"
                  >
                    <Link href={`/dashboard/approvals?id=${getAgentState(selected, pendingApprovals).approvalId}`}>
                      Review & Approve Draft
                    </Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="border border-zinc-200 bg-white py-6 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Link href={`/dashboard/maintenance/${selected.id}#assign-contractor`}>
                      Update Status
                    </Link>
                  </Button>
                )}
                <Button
                  asChild
                  variant="outline"
                  className="border border-zinc-300 bg-white py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-800 shadow-none hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-[#1e1e1e] dark:text-zinc-200 dark:hover:bg-[#2a2a2a] dark:hover:text-white [&_svg]:text-zinc-600 dark:[&_svg]:text-zinc-400"
                >
                  <Link href={`/dashboard/maintenance/${selected.id}`}>Open Full Case</Link>
                </Button>
              </div>
            </div>
          </aside>
        ) : null}
      </main>
    </>
  );
}
