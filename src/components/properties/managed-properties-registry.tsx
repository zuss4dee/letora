"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Circle,
  CircleDollarSign,
  CircleUserRound,
  Command,
  Filter,
  Plus,
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  const [activityLogExpandedByPropertyId, setActivityLogExpandedByPropertyId] = useState<Record<string, boolean>>({});

  const serverOrderIndex = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => map.set(row.id, index));
    return map;
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

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#131313] font-[Inter] text-[#e5e2e1]">
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-[#161616] px-4">
          <div className="flex items-center gap-6">
            <div className="text-lg font-bold tracking-tighter text-white">LETORA</div>
            <div className="relative">
              <Command
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500"
                aria-hidden
              />
              <input
                readOnly
                value="CMD+K TO SEARCH..."
                aria-label="Command search"
                className="w-64 border border-zinc-800 bg-[#0B0B0B] py-1.5 pl-9 pr-3 font-mono text-[10px] uppercase tracking-wider text-zinc-500 outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="flex h-8 w-8 items-center justify-center hover:bg-[#242424]">
              <Bell className="size-4 text-zinc-400" aria-hidden />
            </button>
            <button type="button" className="flex h-8 w-8 items-center justify-center hover:bg-[#242424]">
              <Command className="size-4 text-zinc-400" aria-hidden />
            </button>
            <button type="button" className="flex h-8 w-8 items-center justify-center hover:bg-[#242424]">
              <CircleUserRound className="size-4 text-zinc-400" aria-hidden />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <section
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col",
              inspectorOpen && "border-r border-zinc-800",
            )}
          >
            <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#161616] px-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-400 hover:text-white"
                  onClick={() => setFiltersOpen(true)}
                  aria-expanded={filtersOpen}
                  aria-controls="properties-filters-sheet"
                >
                  <Filter className="size-3.5" aria-hidden />
                  FILTERS ({activeFilterCount})
                </button>
                <div className="h-4 w-px bg-zinc-800" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-400 hover:text-white"
                    >
                      <Command className="size-3.5" aria-hidden />
                      SORT: {sortKeyToolbarLabel(sortKey)}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[220px]">
                    <DropdownMenuRadioGroup
                      value={sortKey}
                      onValueChange={(value) => setSortKey(value as SortKey)}
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <DropdownMenuRadioItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <AddPropertyDialog
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 bg-white px-3 py-1 text-[10px] font-black uppercase text-black hover:bg-zinc-200"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    ADD PROPERTY
                  </button>
                }
              />
            </div>

            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetContent
                id="properties-filters-sheet"
                side="right"
                className="flex w-[min(100%,24rem)] flex-col gap-4"
              >
                <SheetHeader className="text-left">
                  <SheetTitle className="font-[Inter] text-base">Filters</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-1">
                  <Label htmlFor="properties-search" className="text-xs text-zinc-600 dark:text-zinc-400">
                    Search name or location
                  </Label>
                  <Input
                    id="properties-search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type to filter…"
                    className="rounded-[2px]"
                    autoComplete="off"
                  />
                  {searchQuery.trim() ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 self-start px-2 text-[11px]"
                      onClick={() => setSearchQuery("")}
                    >
                      Clear search
                    </Button>
                  ) : null}
                </div>
                <div className="px-1">
                  <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Maintenance</p>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        { id: "all" as const, label: "All" },
                        { id: "attention" as const, label: "Attention" },
                        { id: "optimal" as const, label: "Optimal" },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setMaintenanceFilter(item.id)}
                        className={cn(
                          "border px-2.5 py-1 text-[11px] font-medium",
                          maintenanceFilter === item.id
                            ? "border-zinc-600 bg-zinc-800 text-white"
                            : "border-transparent text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="grid grid-cols-[2fr_1.5fr_1fr_1.2fr_1.2fr_1fr] border-b border-zinc-800 bg-[#1A1A1A] px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">
              <div>Property Name</div>
              <div>Location</div>
              <div className="text-center">Occupancy</div>
              <div className="text-center">Rent Status</div>
              <div className="text-center">Maintenance</div>
              <div className="text-right">Compliance</div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#131313]">
              {rows.length === 0 ? (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm font-semibold text-white">No properties yet</p>
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
                    Add your first property to populate the operations workspace
                  </p>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm font-semibold text-white">No properties match</p>
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
                    Adjust filters or clear search
                  </p>
                </div>
              ) : (
                filteredRows.map((row) => {
                  const isSelected = selected?.id === row.id;
                  const occupancy = Math.max(0, Math.min(100, row.occupancyPct));
                  const rentStatus = rentStatusForRow(row);
                  const maintenanceLabel = row.maintenanceState === "attention" ? "ATTENTION" : "OPTIMAL";
                  const maintenanceColor = row.maintenanceState === "attention" ? "text-yellow-500" : "text-green-400";
                  const complianceSummary = complianceByPropertyId[row.id];
                  const complianceAlert = complianceSummary?.gridAlert ?? false;

                  return (
                    <div
                      key={row.id}
                      data-property-registry-row={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPropertyId(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedPropertyId(row.id);
                        }
                      }}
                      className={cn(
                        "grid cursor-pointer grid-cols-[2fr_1.5fr_1fr_1.2fr_1.2fr_1fr] border-b border-[#282828] px-4 py-2 transition-colors hover:bg-[#242424]",
                        isSelected && "bg-[#1A1A1A]",
                      )}
                    >
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "text-left text-[12px] font-bold",
                            isSelected ? "text-white" : "text-zinc-300",
                          )}
                        >
                          {row.identityTitle}
                        </span>
                      </div>

                      <div className="flex items-center text-[11px] text-zinc-400">{row.identitySubline}</div>

                      <div className="flex flex-col items-center justify-center">
                        <span className="font-mono text-[11px] text-white">
                          {occupancy.toFixed(occupancy === 100 ? 0 : 1)}%
                        </span>
                        <div className="mt-1 h-1 w-12 bg-zinc-800">
                          <div
                            className={cn("h-full", occupancy >= 95 ? "bg-white" : "bg-zinc-400")}
                            style={{ width: `${occupancy}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[9px] font-bold uppercase",
                            rentStatus === "PAID" && "border border-zinc-700 bg-[#1B1C1C] text-[#b5b5b5]",
                            rentStatus === "OVERDUE" && "border border-[#93000a] bg-[#310002] text-[#ffb4ab]",
                          )}
                        >
                          {rentStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-center">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase", maintenanceColor)}>
                          <Circle className={cn("size-2 fill-current", maintenanceColor)} strokeWidth={0} aria-hidden />
                          {maintenanceLabel}
                        </span>
                      </div>

                      <div className="flex items-center justify-end">
                        {!complianceSummary?.hasRecords ? (
                          <span className="font-mono text-[10px] text-zinc-600" title="No compliance records">
                            —
                          </span>
                        ) : complianceSummary.badgeLabel === "Expired" ? (
                          <ShieldAlert className="size-4 text-red-500" aria-hidden />
                        ) : complianceAlert ? (
                          <ShieldAlert className="size-4 text-amber-500" aria-hidden />
                        ) : complianceSummary.badgeLabel === "Incomplete" ? (
                          <Shield className="size-4 text-zinc-500" aria-hidden />
                        ) : (
                          <UserCheck className="size-4 text-green-500" aria-hidden />
                        )}
                      </div>
                    </div>
                  );
                })
              )}

            </div>
          </section>

          {inspectorOpen && selected ? (
            <aside className="hidden h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden bg-[#161616] xl:flex">
              <div className="shrink-0 border-b border-zinc-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="bg-zinc-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                    PROPERTY PROFILE
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-zinc-500 hover:bg-[#242424] hover:text-zinc-300"
                    aria-label="Close profile panel"
                    onClick={() => setSelectedPropertyId(null)}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
                <h2 className="text-[32px] font-bold leading-tight text-white">{selected.identityTitle}</h2>
                <p className="mt-1 text-[11px] uppercase tracking-tight text-zinc-500">{selected.identitySubline}</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-px bg-zinc-800 p-4">
                  <div className="bg-[#1A1A1A] p-3">
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">TENANTS</p>
                    <p className="text-lg font-bold text-white">
                      {selected.activeTenancyCount}{" "}
                      <span className="text-[9px] text-zinc-600">/ {selected.lettableUnitCount} UNITS</span>
                    </p>
                  </div>
                  <div className="bg-[#1A1A1A] p-3">
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">OCCUPANCY</p>
                    <p className="text-lg font-bold text-green-400">
                      {`${selected.occupancyPct.toFixed(selected.occupancyPct === 100 ? 0 : 1)}%`}
                    </p>
                  </div>
                  <div className="bg-[#1A1A1A] p-3">
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">RENT OVERDUE</p>
                    <p className="text-lg font-bold text-zinc-200">{formatCurrencyGBP(selected.rentOverdueGbp)}</p>
                  </div>
                  <div className="bg-[#1A1A1A] p-3">
                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">OPEN TICKETS</p>
                    <p className="text-lg font-bold text-white">{selected.openMaintenanceCount}</p>
                  </div>
                </div>

                <div className="m-4 flex items-center justify-between border border-zinc-800 bg-[#0B0B0B] p-3">
                  <div className="flex items-center gap-3">
                    {selectedCompliance?.badgeLabel === "Expired" ? (
                      <ShieldAlert className="size-4 text-red-500" aria-hidden />
                    ) : selectedCompliance?.badgeLabel === "Due soon" ? (
                      <ShieldAlert className="size-4 text-amber-500" aria-hidden />
                    ) : selectedCompliance?.badgeLabel === "Valid" ? (
                      <Shield className="size-4 text-green-500" aria-hidden />
                    ) : selectedCompliance?.badgeLabel === "Incomplete" ? (
                      <Shield className="size-4 text-amber-400" aria-hidden />
                    ) : (
                      <Shield className="size-4 text-zinc-500" aria-hidden />
                    )}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-tight text-white">COMPLIANCE STATUS</p>
                      <p className="text-[9px] text-zinc-500">{selectedCompliance?.detailLine ?? "No compliance data"}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase",
                      selectedCompliance?.badgeLabel === "—" || !selectedCompliance?.hasRecords
                        ? "text-zinc-500"
                        : selectedCompliance.badgeLabel === "Expired"
                          ? "text-red-500"
                          : selectedCompliance.badgeLabel === "Due soon"
                            ? "text-amber-500"
                            : selectedCompliance.badgeLabel === "Incomplete"
                              ? "text-zinc-400"
                              : "text-green-500",
                    )}
                  >
                    {selectedCompliance?.badgeLabel ?? "—"}
                  </span>
                </div>

                <div className="border-t border-zinc-800 p-4">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">ACTIVITY LOG_</h3>
                    <Link
                      href="/dashboard/activity"
                      className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-zinc-600 underline-offset-4 hover:text-zinc-400 hover:underline"
                    >
                      View all activity
                    </Link>
                  </div>
                  {inspectorActivityEntries.length === 0 ? (
                    <p className="font-mono text-[10px] text-zinc-500">No recent activity for this property.</p>
                  ) : (
                    <div className="font-mono text-[10px]">
                      <div
                        className={cn(
                          "space-y-3",
                          !activityLogExpanded && ACTIVITY_LOG_COLLAPSED_LIST_MAX_CLASSES,
                        )}
                      >
                        {visibleActivityEntries.map((entry) => (
                          <div key={entry.id} className="flex gap-3">
                            <div
                              className={cn("h-full w-1 shrink-0", propertyInspectorActivityBarClass(entry.accent))}
                            />
                            <div className="min-w-0 flex flex-col gap-1">
                              <span className="text-zinc-500">{formatPropertyInspectorActivityClock(entry.at)}</span>
                              <span className="break-words text-zinc-200">{entry.title}</span>
                              <span
                                className={cn(
                                  entry.accent === "danger" ? "text-red-400" : "text-zinc-400",
                                  entry.accent === "success" && "font-bold text-white",
                                  !activityLogExpanded && ACTIVITY_LOG_DETAIL_COLLAPSED_CLASSES,
                                )}
                                title={entry.detail}
                              >
                                {entry.detail}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {activityLogHasMore ? (
                        <button
                          type="button"
                          onClick={() => {
                            const id = selected.id;
                            setActivityLogExpandedByPropertyId((prev) => {
                              const next = { ...prev };
                              if (next[id]) {
                                delete next[id];
                              } else {
                                next[id] = true;
                              }
                              return next;
                            });
                          }}
                          className="mt-3 w-full pt-1 text-left text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
                        >
                          {activityLogExpanded ? "Show less" : "Show more"}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 space-y-1 border-t border-zinc-800 bg-[#0B0B0B] p-4">
                <Link
                  href={`/dashboard/properties/${selected.id}`}
                  className="flex items-center justify-between bg-[#161616] px-3 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-[#242424] hover:text-white"
                >
                  VIEW PROPERTY DETAILS
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
                <Link
                  href={`/dashboard/compliance?propertyId=${encodeURIComponent(selected.id)}`}
                  className="flex items-center justify-between bg-[#161616] px-3 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-[#242424] hover:text-white"
                >
                  OPEN COMPLIANCE
                  <Shield className="size-3.5" aria-hidden />
                </Link>
                <Link
                  href={`/dashboard/tenants?propertyId=${encodeURIComponent(selected.id)}`}
                  className="flex items-center justify-between bg-[#161616] px-3 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-[#242424] hover:text-white"
                >
                  VIEW TENANTS
                  <Users className="size-3.5" aria-hidden />
                </Link>
                <Link
                  href={`/dashboard/maintenance?propertyId=${encodeURIComponent(selected.id)}`}
                  className="flex items-center justify-between bg-[#161616] px-3 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-[#242424] hover:text-white"
                >
                  VIEW MAINTENANCE
                  <Wrench className="size-3.5" aria-hidden />
                </Link>
                <Link
                  href={`/dashboard/rent-tracker?propertyId=${encodeURIComponent(selected.id)}`}
                  className="flex items-center justify-between bg-[#161616] px-3 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-[#242424] hover:text-white"
                >
                  VIEW RENT
                  <CircleDollarSign className="size-3.5" aria-hidden />
                </Link>
              </div>
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  );
}
