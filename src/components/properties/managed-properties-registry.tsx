"use client";

/* eslint-disable @typescript-eslint/no-unused-vars -- legacy registry shell: unused imports/helpers retained for planned controls */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Building2,
  Circle,
  CircleDollarSign,
  CircleUserRound,
  Command,
  Download,
  Filter,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PropertyPortfolioRow } from "@/lib/actions/properties";
import { cn } from "@/lib/utils";

import type { PropertyInspectorComplianceSummary } from "@/app/(dashboard)/dashboard/properties/property-inspector-compliance-types";
import type { PropertyInspectorActivityEntry } from "@/app/(dashboard)/dashboard/properties/property-inspector-activity-display";
import {
  formatPropertyInspectorActivityClock,
  propertyInspectorActivityBarClass,
} from "@/app/(dashboard)/dashboard/properties/property-inspector-activity-display";

type RentStatus = "PAID" | "OVERDUE";

function formatCurrencyGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function rentStatusForRow(row: PropertyPortfolioRow): RentStatus {
  if (row.rentOverdueGbp > 0) return "OVERDUE";
  return "PAID";
}

const SORT_OPTIONS = [
  { id: "occupancy_desc" as const, label: "Occupancy (high first)" },
  { id: "occupancy_asc" as const, label: "Occupancy (low first)" },
  { id: "name_asc" as const, label: "Property name (A–Z)" },
  { id: "name_desc" as const, label: "Property name (Z–A)" },
  { id: "maintenance_attention_first" as const, label: "Maintenance: attention first" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["id"];

function sortKeyToolbarLabel(key: SortKey): string {
  switch (key) {
    case "occupancy_desc":
      return "Occupancy";
    case "occupancy_asc":
      return "Occupancy (low)";
    case "name_asc":
      return "Name A–Z";
    case "name_desc":
      return "Name Z–A";
    case "maintenance_attention_first":
      return "Maintenance";
    default:
      return "Occupancy";
  }
}

type MaintenanceFilter = "all" | "attention" | "optimal";

/** Visible activity rows in the inspector before "Show more". */
const ACTIVITY_LOG_COLLAPSED_COUNT = 3;
/** Tailwind classes for truncated detail text when the log is collapsed. */
const ACTIVITY_LOG_DETAIL_COLLAPSED_CLASSES = "line-clamp-2 break-words";
/** Caps list height when collapsed so long titles/details do not stretch the panel. */
const ACTIVITY_LOG_COLLAPSED_LIST_MAX_CLASSES = "max-h-[13rem] overflow-hidden";

function applySearchFilter(rows: PropertyPortfolioRow[], q: string): PropertyPortfolioRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const title = (row.identityTitle ?? "").toLowerCase();
    const sub = (row.identitySubline ?? "").toLowerCase();
    return title.includes(needle) || sub.includes(needle);
  });
}

function applyMaintenanceFilter(rows: PropertyPortfolioRow[], f: MaintenanceFilter): PropertyPortfolioRow[] {
  if (f === "all") return rows;
  if (f === "attention") return rows.filter((r) => r.maintenanceState === "attention");
  return rows.filter((r) => r.maintenanceState === "optimal");
}

export function ManagedPropertiesRegistry({
  rows,
  activityByPropertyId,
  complianceByPropertyId,
  initialSelectedPropertyId = null,
}: {
  rows: PropertyPortfolioRow[];
  activityByPropertyId: Record<string, PropertyInspectorActivityEntry[]>;
  complianceByPropertyId: Record<string, PropertyInspectorComplianceSummary>;
  initialSelectedPropertyId?: string | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("occupancy_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [maintenanceFilter, setMaintenanceFilter] = useState<MaintenanceFilter>("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(() => {
    if (!initialSelectedPropertyId) return null;
    return rows.some((r) => r.id === initialSelectedPropertyId) ? initialSelectedPropertyId : null;
  });
  const didScrollToInitialRef = useRef(false);

  useEffect(() => {
    didScrollToInitialRef.current = false;
  }, [initialSelectedPropertyId]);

  useEffect(() => {
    if (initialSelectedPropertyId == null) return;
    if (!rows.some((r) => r.id === initialSelectedPropertyId)) return;
    setSelectedPropertyId(initialSelectedPropertyId);
    // Only react to URL/deep-link changes, not `rows` reference churn (avoids clobbering manual selection).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rows read from latest render via closure
  }, [initialSelectedPropertyId]);
  const [activityLogExpandedByPropertyId, setActivityLogExpandedByPropertyId] = useState<Record<string, boolean>>(
    {},
  );
  const [emptyPropertyOpen, setEmptyPropertyOpen] = useState(false);

  const serverOrderIndex = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => map.set(row.id, index));
    return map;
  }, [rows]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      occupied: rows.filter((r) => r.occupancyPct > 0).length,
      vacant: rows.filter((r) => r.occupancyPct === 0).length,
      withArrears: rows.filter((r) => r.rentOverdueGbp > 0).length,
      withMaintenance: rows.filter((r) => r.openMaintenanceCount > 0).length,
    };
  }, [rows]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    switch (sortKey) {
      case "occupancy_desc":
        return copy.sort((a, b) => b.occupancyPct - a.occupancyPct);
      case "occupancy_asc":
        return copy.sort((a, b) => a.occupancyPct - b.occupancyPct);
      case "name_asc":
        return copy.sort((a, b) => a.identityTitle.localeCompare(b.identityTitle));
      case "name_desc":
        return copy.sort((a, b) => b.identityTitle.localeCompare(a.identityTitle));
      case "maintenance_attention_first":
        return copy.sort((a, b) => {
          const pri = (s: PropertyPortfolioRow) => (s.maintenanceState === "attention" ? 0 : 1);
          const p = pri(a) - pri(b);
          if (p !== 0) return p;
          return (serverOrderIndex.get(a.id) ?? 0) - (serverOrderIndex.get(b.id) ?? 0);
        });
      default:
        return copy;
    }
  }, [rows, sortKey, serverOrderIndex]);

  const filteredRows = useMemo(() => {
    const byMaint = applyMaintenanceFilter(sortedRows, maintenanceFilter);
    return applySearchFilter(byMaint, searchQuery);
  }, [sortedRows, maintenanceFilter, searchQuery]);

  const selected = useMemo(() => {
    if (filteredRows.length === 0) return null;
    if (selectedPropertyId === null) return null;
    return filteredRows.find((row) => row.id === selectedPropertyId) ?? null;
  }, [filteredRows, selectedPropertyId]);

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) + (maintenanceFilter !== "all" ? 1 : 0);

  const inspectorOpen = selected != null;

  const inspectorActivityEntries = useMemo(() => {
    const id = selected?.id;
    if (!id) return [];
    return activityByPropertyId[id] ?? [];
  }, [activityByPropertyId, selected?.id]);

  const activityLogExpanded = Boolean(selected?.id && activityLogExpandedByPropertyId[selected.id]);

  const visibleActivityEntries = useMemo(() => {
    if (activityLogExpanded) return inspectorActivityEntries;
    return inspectorActivityEntries.slice(0, ACTIVITY_LOG_COLLAPSED_COUNT);
  }, [activityLogExpanded, inspectorActivityEntries]);

  const activityLogHasMore = inspectorActivityEntries.length > ACTIVITY_LOG_COLLAPSED_COUNT;

  const selectedCompliance = useMemo(() => {
    const id = selected?.id;
    if (!id) return null;
    return complianceByPropertyId[id] ?? null;
  }, [complianceByPropertyId, selected?.id]);

  useEffect(() => {
    if (
      didScrollToInitialRef.current ||
      initialSelectedPropertyId == null ||
      selectedPropertyId !== initialSelectedPropertyId
    ) {
      return;
    }
    didScrollToInitialRef.current = true;
    const id = initialSelectedPropertyId;
    requestAnimationFrame(() => {
      document.querySelector(`[data-property-registry-row="${CSS.escape(id)}"]`)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    });
  }, [initialSelectedPropertyId, selectedPropertyId]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-[#0e0e0e]">
        <EmptyState
          icon={Building2}
          title="Your portfolio is empty"
          description="Add your first property to get started with Letora."
          actionLabel="Add Property"
          onAction={() => setEmptyPropertyOpen(true)}
          className="flex-1"
        />
        <AddPropertyDialog open={emptyPropertyOpen} onOpenChange={setEmptyPropertyOpen} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-100 dark:bg-[#0e0e0e]">
      {/* OPERATIONAL HEADER */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white px-6 py-4 dark:border-[#232323] dark:bg-zinc-900">
        <div>
          <h1 className="text-[16px] font-bold tracking-tight text-zinc-900 uppercase dark:text-white">
            Portfolio Operations
          </h1>
          <p className="text-[11px] text-zinc-500">Asset Oversight & Occupancy Command</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 dark:text-zinc-600" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full border border-zinc-200/90 bg-white pl-8 pr-3 text-[11px] text-zinc-900 placeholder-zinc-400 transition-colors focus:border-zinc-400 focus:outline-none dark:border-[#232323] dark:bg-zinc-900 dark:text-zinc-300 dark:placeholder-zinc-600 dark:focus:border-zinc-700"
              placeholder="Search address, postcode..."
            />
          </div>
          <AddPropertyDialog
            trigger={
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 border border-zinc-200/90 bg-zinc-50 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-[#232323] dark:bg-[#111111] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-white"
              >
                <Plus className="size-3.5" />
                Add Property
              </button>
            }
          />
        </div>
      </div>

      {/* KPI SUMMARY STRIP */}
      <div className="grid shrink-0 grid-cols-5 border-b border-zinc-200/80 bg-zinc-50 dark:border-[#232323] dark:bg-[#0B0B0B]">
        {[
          { label: "Total Assets", value: stats.total },
          { label: "Occupied", value: stats.occupied, tone: 'emerald' },
          { label: "Vacant", value: stats.vacant, tone: stats.vacant > 0 ? 'amber' : 'zinc' },
          { label: "Arrears Risk", value: stats.withArrears, tone: stats.withArrears > 0 ? 'rose' : 'zinc' },
          { label: "Open Issues", value: stats.withMaintenance, tone: stats.withMaintenance > 0 ? 'amber' : 'zinc' },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col border-r border-zinc-200/80 p-4 last:border-r-0 dark:border-r-[#232323]">
            <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{stat.label}</span>
            <span className={cn(
              "text-lg font-bold tabular-nums",
              stat.tone === 'rose' ? "text-rose-600 dark:text-rose-400" :
              stat.tone === 'amber' ? "text-amber-600 dark:text-amber-400" :
              stat.tone === 'emerald' ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-white"
            )}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <section className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-zinc-900",
          inspectorOpen && "border-r border-zinc-200/80 dark:border-[#232323]"
        )}>
          <div className="sticky top-0 z-10 grid grid-cols-12 border-b border-zinc-200/80 bg-zinc-50 px-6 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:border-[#232323] dark:bg-[#111111]">
            <div className="col-span-5">Property Identity</div>
            <div className="col-span-2 text-center">Occupancy</div>
            <div className="col-span-2 text-right">Rent Risk</div>
            <div className="col-span-2 text-center">Maintenance</div>
            <div className="col-span-1 text-right">State</div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-zinc-200/80 dark:divide-[#232323]">
            {rows.length === 0 ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">No properties yet</p>
                <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
                  Add your first property to populate the operations workspace
                </p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">No properties match</p>
                <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
                  Adjust search or filters
                </p>
              </div>
            ) : (
              filteredRows.map((row) => {
                const isSelected = selected?.id === row.id;
                const occupancy = Math.max(0, Math.min(100, row.occupancyPct));
                const complianceSummary = complianceByPropertyId[row.id];

                return (
                  <div
                    key={row.id}
                    onClick={() => setSelectedPropertyId(row.id)}
                    className={cn(
                      "grid cursor-pointer grid-cols-12 items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-100 dark:hover:bg-background dark:bg-[#161616]",
                      isSelected ? "bg-zinc-100 shadow-[inset_2px_0_0_0_#18181b] dark:bg-[#111111] dark:shadow-[inset_2px_0_0_0_#ffffff]" : "bg-transparent"
                    )}
                  >
                    <div className="col-span-5 min-w-0">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">{row.identityTitle}</span>
                        <span className="text-[10px] text-zinc-500 truncate">{row.identitySubline}</span>
                      </div>
                      {row.currentTenantName && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500/80">
                            Active: {row.currentTenantName}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 flex flex-col items-center justify-center">
                      <span className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                        {occupancy}%
                      </span>
                      <div className="mt-1 h-1 w-12 bg-zinc-200 dark:bg-[#232323]">
                        <div
                          className={cn("h-full transition-all", occupancy === 100 ? "bg-emerald-500" : "bg-zinc-600")}
                          style={{ width: `${occupancy}%` }}
                        />
                      </div>
                    </div>

                    <div className="col-span-2 text-right">
                      <div className={cn(
                        "text-[11px] font-bold font-mono",
                        row.rentOverdueGbp > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-100"
                      )}>
                        {formatCurrencyGBP(row.rentOverdueGbp)}
                      </div>
                      <div className="text-[9px] text-zinc-500 uppercase tracking-tighter">Arrears</div>
                    </div>

                    <div className="col-span-2 flex flex-col items-center justify-center">
                      <span className={cn(
                        "text-[10px] font-bold uppercase",
                        row.openMaintenanceCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-500"
                      )}>
                        {row.openMaintenanceCount} {row.openMaintenanceCount === 1 ? 'ISSUE' : 'ISSUES'}
                      </span>
                    </div>

                    <div className="col-span-1 flex items-center justify-end">
                      {complianceSummary?.badgeLabel === "Expired" ? (
                        <ShieldAlert className="size-4 text-rose-500" />
                      ) : row.maintenanceState === "attention" ? (
                        <Wrench className="size-4 text-amber-500" />
                      ) : (
                        <Circle className="size-1.5 fill-emerald-500 text-emerald-500" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </section>

          {inspectorOpen && selected ? (
            <aside className="hidden h-full min-h-0 w-96 shrink-0 flex-col border-l border-zinc-200/80 bg-zinc-50 dark:border-[#232323] dark:bg-[#0B0B0B] xl:flex">
              <div className="shrink-0 border-b border-zinc-200/80 bg-white p-6 dark:border-[#232323] dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Asset Profile</span>
                  <button
                    onClick={() => setSelectedPropertyId(null)}
                    className="group flex h-6 w-6 items-center justify-center border border-zinc-200/90 transition-colors hover:border-zinc-400 dark:border-[#232323] dark:hover:border-zinc-500"
                  >
                    <X className="size-3.5 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                  </button>
                </div>
                <h2 className="text-[20px] font-bold leading-tight text-zinc-900 dark:text-white">{selected.identityTitle}</h2>
                <p className="mt-1 text-[11px] uppercase tracking-tight text-zinc-500">{selected.identitySubline}</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-px border-b border-zinc-200/80 bg-zinc-200/80 dark:border-[#232323] dark:bg-[#232323]">
                  <div className="bg-white p-4 dark:bg-zinc-900">
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Occupancy</p>
                    <p className={cn(
                      "text-xl font-bold tabular-nums",
                      selected.occupancyPct === 100 ? "text-emerald-600 dark:text-emerald-400" :
                      selected.occupancyPct > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-500"
                    )}>
                      {selected.occupancyPct}%
                    </p>
                  </div>
                  <div className="bg-white p-4 text-right dark:bg-zinc-900">
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Arrears Risk</p>
                    <p className={cn(
                      "text-xl font-bold tabular-nums",
                      selected.rentOverdueGbp > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-white"
                    )}>
                      {formatCurrencyGBP(selected.rentOverdueGbp)}
                    </p>
                  </div>
                  <div className="bg-white p-4 dark:bg-zinc-900">
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Maintenance</p>
                    <p className={cn(
                      "text-xl font-bold tabular-nums",
                      selected.openMaintenanceCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-white"
                    )}>
                      {selected.openMaintenanceCount} <span className="text-[10px] text-zinc-600">OPEN</span>
                    </p>
                  </div>
                  <div className="bg-white p-4 text-right dark:bg-zinc-900">
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Units</p>
                    <p className="text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
                      {selected.activeTenancyCount} <span className="text-[10px] text-zinc-600">/ {selected.lettableUnitCount}</span>
                    </p>
                  </div>
                </div>

                {selected.currentTenantName && (
                  <div className="border-b border-zinc-200/80 bg-zinc-100 p-6 text-center dark:border-[#232323] dark:bg-[#0e0e0e]">
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Primary Occupant</p>
                    <p className="text-[16px] font-bold text-zinc-900 dark:text-white">{selected.currentTenantName}</p>
                    <Link
                      href={`/dashboard/tenants?search=${encodeURIComponent(selected.currentTenantName)}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                      View Tenant Profile <ArrowRight className="size-3" />
                    </Link>
                  </div>
                )}

                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-center">Operational Activity</h3>
                    <Link
                      href="/dashboard/activity"
                      className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      History
                    </Link>
                  </div>
                  
                  {inspectorActivityEntries.length === 0 ? (
                    <div className="border border-dashed border-zinc-200/90 p-4 text-center dark:border-[#232323]">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600">No recent activity</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visibleActivityEntries.map((entry) => (
                        <div key={entry.id} className="relative pl-4">
                          <div className={cn(
                            "absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full",
                            entry.accent === 'danger' ? 'bg-rose-500' :
                            entry.accent === 'success' ? 'bg-emerald-500' :
                            entry.accent === 'attention' ? 'bg-amber-500' : 'bg-zinc-600'
                          )} />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200">{entry.title}</span>
                            <span className="text-[10px] leading-relaxed text-zinc-500 line-clamp-2">{entry.detail}</span>
                            <span className="mt-1 text-[9px] font-medium text-zinc-600 uppercase tracking-tighter">
                              {formatPropertyInspectorActivityClock(entry.at)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {activityLogHasMore && (
                        <button
                          onClick={() => {
                            const id = selected.id;
                            setActivityLogExpandedByPropertyId((prev) => ({
                              ...prev,
                              [id]: !prev[id]
                            }));
                          }}
                          className="w-full border border-zinc-200/90 py-2 text-[9px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-[#232323] dark:hover:border-zinc-700 dark:hover:text-zinc-300"
                        >
                          {activityLogExpanded ? "View Less" : "View Full Log"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto border-t border-zinc-200/80 bg-white p-4 space-y-2 dark:border-[#232323] dark:bg-zinc-900">
                {[
                  { label: "Asset Deep-Dive", href: `/dashboard/properties/${selected.id}`, icon: ArrowRight },
                  { label: "Compliance Registry", href: `/dashboard/compliance?propertyId=${selected.id}`, icon: Shield },
                  { label: "Rent Tracker", href: `/dashboard/rent-tracker?propertyId=${selected.id}`, icon: CircleDollarSign },
                  { label: "Maintenance Queue", href: `/dashboard/maintenance?propertyId=${selected.id}`, icon: Wrench },
                ].map((action, i) => (
                  <Link
                    key={i}
                    href={action.href}
                    className="flex items-center justify-between border border-zinc-200/90 bg-zinc-50 px-3 py-2 text-[10px] font-bold uppercase text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-[#232323] dark:bg-[#111111] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-white"
                  >
                    {action.label}
                    <action.icon className="size-3.5" />
                  </Link>
                ))}
              </div>
            </aside>
          ) : null}
      </main>
    </div>
  );
}
