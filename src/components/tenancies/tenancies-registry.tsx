"use client";

/* eslint-disable @typescript-eslint/no-unused-vars -- tenancy registry scaffold: unused imports/helpers for upcoming column tooling */
import { propertyInspectorActivityBarClass } from "@/app/(dashboard)/dashboard/properties/property-inspector-activity-display";
import {
  formatTenancyInspectorWhen,
  humanizeTenancyOnboardingStatus,
  rightToRentLabel,
  type TenancyInspectorActivityEntry,
  type TenancyOnboardingTasksByTenancyId,
} from "@/app/(dashboard)/dashboard/tenancies/tenancy-inspector-types";
import { AddTenancyDialog } from "@/components/rent/add-tenancy-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogPaymentDialog } from "@/components/rent/log-payment-dialog";
import { EditTenancyDialog } from "@/components/tenancies/edit-tenancy-dialog";
import type { RentPaymentRow, TenancyRow } from "@/lib/actions/tenancies";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Ellipsis, FileText, Hourglass, MinusCircle, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TENANCIES_COLUMN_STORAGE_KEY = "letora-tenancies-columns-v1";

/** Visible activity rows before "Show more". */
const TENANCY_ACTIVITY_COLLAPSED_COUNT = 4;
const TENANCY_ACTIVITY_DETAIL_COLLAPSED_CLASSES = "line-clamp-2 break-words";
const TENANCY_ACTIVITY_COLLAPSED_LIST_MAX_CLASSES = "max-h-[14rem] overflow-hidden";

type TenancyColumnPrefs = {
  moveInStage: boolean;
  referencing: boolean;
};

function readTenancyColumnPrefs(): TenancyColumnPrefs {
  if (typeof window === "undefined") {
    return { moveInStage: true, referencing: true };
  }
  try {
    const raw = localStorage.getItem(TENANCIES_COLUMN_STORAGE_KEY);
    if (!raw) return { moveInStage: true, referencing: true };
    const parsed = JSON.parse(raw) as Partial<TenancyColumnPrefs>;
    return {
      moveInStage: parsed.moveInStage !== false,
      referencing: parsed.referencing !== false,
    };
  } catch {
    return { moveInStage: true, referencing: true };
  }
}

const SORT_OPTIONS = [
  { id: "date_added_desc" as const, label: "Date added (newest first)" },
  { id: "date_added_asc" as const, label: "Date added (oldest first)" },
  { id: "start_date_desc" as const, label: "Start date (latest first)" },
  { id: "start_date_asc" as const, label: "Start date (earliest first)" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["id"];

function sortKeyTriggerLabel(key: SortKey): string {
  switch (key) {
    case "date_added_desc":
      return "Date added";
    case "date_added_asc":
      return "Date added (oldest)";
    case "start_date_desc":
      return "Start date (latest)";
    case "start_date_asc":
      return "Start date (earliest)";
    default:
      return "Date added";
  }
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseIsoDate(date: string | null) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fmtShortDate(date: string | null): string {
  const parsed = parseIsoDate(date);
  if (!parsed) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtInspectorDate(date: string | null): string {
  const parsed = parseIsoDate(date);
  if (!parsed) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).toUpperCase();
}

function initials(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function splitAddress(address: string | null): { line1: string; line2: string } {
  if (!address?.trim()) return { line1: "Property", line2: "—" };
  const [line1, ...rest] = address.split(",");
  return {
    line1: line1?.trim() || "Property",
    line2: rest.join(",").trim() || "—",
  };
}

function tenancyRef(tenancyId: string): string {
  return `TN-${tenancyId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

type PaymentUi = "paid" | "arrears" | "pending";

function paymentForTenancy(
  tenancyId: string,
  paymentMap: Map<string, RentPaymentRow>,
): { ui: PaymentUi; arrears: number; payment: RentPaymentRow | null } {
  const payment = paymentMap.get(tenancyId) ?? null;
  if (!payment) return { ui: "pending", arrears: 0, payment: null };
  const status = (payment.status ?? "pending").toLowerCase();
  if (status === "paid") return { ui: "paid", arrears: 0, payment };
  if (status === "overdue") {
    const due = payment.amountDue ?? 0;
    const paid = payment.amountPaid ?? 0;
    return { ui: "arrears", arrears: Math.max(0, due - paid), payment };
  }
  return { ui: "pending", arrears: 0, payment };
}

function statusLabel(status: string | null): "Active" | "Pending" | "Ending" | "Onboarding" {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "pending") return "Pending";
  if (normalized === "ended" || normalized === "ending") return "Ending";
  return "Onboarding";
}

function onboardingProgress(onboardingStatus: string | null): { pct: number; label: string } {
  const normalized = (onboardingStatus ?? "").toLowerCase();
  if (normalized === "complete" || normalized === "active" || normalized === "signed") {
    return { pct: 100, label: "Complete" };
  }
  if (normalized === "contract_sent" || normalized === "pending_signature") {
    return { pct: 66, label: "Onboarding" };
  }
  if (normalized === "references") return { pct: 52, label: "Onboarding" };
  if (normalized === "in_progress") return { pct: 35, label: "Onboarding" };
  if (normalized === "not_started" || normalized === "") return { pct: 15, label: "Onboarding" };
  return { pct: 40, label: "Onboarding" };
}

function termLength(startDate: string | null, endDate: string | null): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return "—";
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (months <= 0) return "—";
  return `${months} MONTHS`;
}

export function TenanciesRegistry({
  tenancies,
  paymentsThisMonth,
  userId,
  propertyOptions,
  tenantOptions,
  activityByTenancyId,
  onboardingTasksByTenancyId,
  totalPropertiesCount = 0,
}: {
  tenancies: TenancyRow[];
  paymentsThisMonth: RentPaymentRow[];
  userId: string | null;
  propertyOptions: Array<{ id: string; label: string }>;
  tenantOptions: Array<{ id: string; label: string }>;
  activityByTenancyId: Record<string, TenancyInspectorActivityEntry[]>;
  onboardingTasksByTenancyId: TenancyOnboardingTasksByTenancyId;
  totalPropertiesCount?: number;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "onboarding" | "overdue">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date_added_desc");
  const [selectedTenancyId, setSelectedTenancyId] = useState<string | null>(tenancies[0]?.id ?? null);
  const [activityLogExpandedByTenancyId, setActivityLogExpandedByTenancyId] = useState<
    Record<string, boolean>
  >({});
  const [emptyTenancyOpen, setEmptyTenancyOpen] = useState(false);

  const paymentByTenancy = useMemo(() => {
    const map = new Map<string, RentPaymentRow>();
    for (const payment of paymentsThisMonth) {
      const tenancyId = payment.tenancyId;
      if (!tenancyId || map.has(tenancyId)) continue;
      map.set(tenancyId, payment);
    }
    return map;
  }, [paymentsThisMonth]);

  // B. Top Summary Row (KPIs)
  const activeTenancies = useMemo(() => tenancies.filter((t) => (t.status ?? "").toLowerCase() === "active"), [tenancies]);
  const activeCount = activeTenancies.length;
  
  const endingSoonCount = useMemo(() => {
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);
    const next30DaysIso = next30Days.toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);
    
    return tenancies.filter((t) => 
      t.status === "active" && 
      t.endDate && 
      t.endDate >= todayIso && 
      t.endDate <= next30DaysIso
    ).length;
  }, [tenancies]);

  const vacantCount = Math.max(0, totalPropertiesCount - activeCount);
  
  const monthlyRentExpected = useMemo(() => 
    activeTenancies.reduce((sum, t) => sum + (t.monthlyRent ?? 0), 0)
  , [activeTenancies]);

  const sortedRows = useMemo(() => {
    const copy = [...tenancies];
    switch (sortKey) {
      case "date_added_desc":
        return copy;
      case "date_added_asc":
        return copy.reverse();
      case "start_date_desc":
        return copy.sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
      case "start_date_asc":
        return copy.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
      default:
        return copy;
    }
  }, [tenancies, sortKey]);

  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      const status = statusLabel(row.status).toLowerCase();
      const payment = paymentForTenancy(row.id, paymentByTenancy);
      if (filter === "all") return true;
      if (filter === "active") return status === "active";
      if (filter === "pending") return status === "pending";
      if (filter === "onboarding") return status === "onboarding";
      if (filter === "overdue") return payment.ui === "arrears";
      return true;
    });
  }, [sortedRows, paymentByTenancy, filter]);

  const selected = useMemo(() => {
    if (filteredRows.length === 0) return null;
    if (selectedTenancyId === null) return null;
    return (
      filteredRows.find((row) => row.id === selectedTenancyId) ??
      filteredRows[0] ??
      null
    );
  }, [filteredRows, selectedTenancyId]);

  const selectedPayment = selected ? paymentForTenancy(selected.id, paymentByTenancy) : null;
  const inspectorOpen = selected != null;

  const inspectorActivityEntries = useMemo(() => {
    const id = selected?.id;
    if (!id) return [];
    return activityByTenancyId[id] ?? [];
  }, [activityByTenancyId, selected?.id]);

  const activityLogExpanded = Boolean(selected?.id && activityLogExpandedByTenancyId[selected.id]);
  const activityLogHasMore = inspectorActivityEntries.length > TENANCY_ACTIVITY_COLLAPSED_COUNT;

  const visibleActivityEntries = useMemo(() => {
    if (activityLogExpanded) return inspectorActivityEntries;
    return inspectorActivityEntries.slice(0, TENANCY_ACTIVITY_COLLAPSED_COUNT);
  }, [activityLogExpanded, inspectorActivityEntries]);

  const rtr = selected ? rightToRentLabel(selected.tenantRightToRentStatus) : { label: "PENDING", passed: false };

  if (tenancies.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col text-zinc-900 dark:text-[#e5e2e1]">
        <EmptyState
          icon={FileText}
          title="No tenancies found"
          description="Create a tenancy to link a tenant to a property."
          actionLabel="New Tenancy"
          onAction={() => setEmptyTenancyOpen(true)}
          className="flex-1"
        />
        <AddTenancyDialog
          properties={propertyOptions}
          tenants={tenantOptions}
          open={emptyTenancyOpen}
          onOpenChange={setEmptyTenancyOpen}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col text-zinc-900 dark:text-[#e5e2e1]">
      {/* B. Top Summary Row */}
      <div className="mb-8 grid grid-cols-1 gap-px border border-zinc-200/90 bg-zinc-200/90 sm:grid-cols-2 lg:grid-cols-4 dark:border-[#333333] dark:bg-[#333333]">
        <div className="flex flex-col bg-white p-4 dark:bg-[#161616]">
          <span className="mb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-500">Active Tenancies</span>
          <span className="text-2xl font-bold tabular-nums text-zinc-900 md:text-3xl dark:text-white">{activeCount}</span>
        </div>
        <div className="flex flex-col bg-white p-4 dark:bg-[#161616]">
          <span className="mb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-500">Ending Soon</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-zinc-900 md:text-3xl dark:text-white">{endingSoonCount}</span>
            {endingSoonCount > 0 && (
              <span className="bg-red-100 px-1 py-0.5 text-[8px] font-bold uppercase text-red-900 dark:bg-[#93000a] dark:text-[#ffdad6]">
                Review Required
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col bg-white p-4 dark:bg-[#161616]">
          <span className="mb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-500">Vacant Units</span>
          <span className={cn("text-2xl font-bold tabular-nums md:text-3xl", vacantCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-white")}>
            {vacantCount}
          </span>
        </div>
        <div className="flex flex-col bg-white p-4 dark:bg-[#161616]">
          <span className="mb-2 text-[9px] font-bold uppercase tracking-wider text-zinc-500">Monthly Yield (Live)</span>
          <span className="text-2xl font-bold tabular-nums text-emerald-700 md:text-3xl dark:text-[#afefdd]">{gbp.format(monthlyRentExpected)}</span>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 bg-zinc-50 dark:bg-[#0e0e0e]">
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-transparent",
            inspectorOpen && "border-r border-zinc-200/80 dark:border-[#232323]",
          )}
        >
          {/* List Toolbar */}
          <div className="flex items-center justify-between border-b border-zinc-200/80 px-3 py-2 dark:border-[#232323]">
            <div className="flex items-center gap-1 text-[11px]">
              {[
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "pending", label: "Pending" },
                { id: "onboarding", label: "Onboarding" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id as typeof filter)}
                  className={cn(
                    "h-7 border px-3 text-[11px] font-medium transition-colors",
                    filter === item.id
                      ? "border-zinc-300 bg-zinc-200 text-zinc-900 dark:border-[#3a3a3a] dark:bg-[#1d1d1d] dark:text-[#f2f2f2]"
                      : "border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-[#737373] dark:hover:bg-background dark:bg-[#1a1a1a] dark:hover:text-[#c4c7c8]",
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilter("overdue")}
                className={cn(
                  "flex h-7 items-center border px-3 text-[11px] font-medium transition-colors",
                  filter === "overdue"
                    ? "border-zinc-300 bg-zinc-200 text-red-700 dark:border-[#3a3a3a] dark:bg-[#1d1d1d] dark:text-[#ffb4ab]"
                    : "border-transparent text-red-600 hover:bg-red-50 dark:text-[#ff8c8c] dark:hover:bg-background dark:bg-[#1a1a1a]",
                )}
              >
                <span className="mr-2 size-1.5 rounded-full bg-red-400 dark:bg-[#ffb4ab]" />
                Arrears
              </button>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-zinc-500 dark:text-[#7a7a7a]">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="hover:text-zinc-800 dark:hover:text-[#c4c7c8]">
                    Sort: {sortKeyTriggerLabel(sortKey)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[220px]">
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
          </div>

          {/* C. Main Tenancies List/Table */}
          <div className="min-h-0 flex-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="min-w-[640px] w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-zinc-50 text-[10px] uppercase tracking-[0.08em] text-zinc-600 dark:bg-[#161616] dark:text-zinc-400">
                <tr className="border-b border-zinc-200 dark:border-[#232323]">
                  <th className="px-3 py-2.5 font-medium">Occupant</th>
                  <th className="px-3 py-2.5 font-medium">Property</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">Rent</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">Dates</th>
                  <th className="px-3 py-2.5 font-medium">Due State</th>
                </tr>
              </thead>
              <tbody className="text-[12px] text-zinc-800 dark:text-zinc-200">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-12 text-center text-[12px] text-zinc-500 dark:text-[#7b7b7b]">
                      No active tenancy records match this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const address = splitAddress(row.propertyAddress);
                    const payment = paymentForTenancy(row.id, paymentByTenancy);
                    const rowStatus = statusLabel(row.status);
                    const isSelected = selected?.id === row.id;
                    const paymentDue = payment.payment?.amountDue ?? row.monthlyRent ?? 0;
                    
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedTenancyId(row.id)}
                        className={cn(
                          "group cursor-pointer border-b border-zinc-200/80 transition-colors hover:bg-zinc-100 dark:border-[#232323] dark:hover:bg-background dark:bg-[#1b1b1b]",
                          isSelected && "bg-zinc-100 dark:bg-[#1a1a1a]",
                        )}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-6 items-center justify-center border border-zinc-300 bg-zinc-100 text-[10px] text-zinc-700 dark:border-[#353535] dark:bg-[#202020] dark:text-[#d0d0d0]">
                              {initials(row.tenantFullName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-zinc-900 group-hover:text-zinc-950 dark:text-[#f0f0f0] dark:group-hover:text-white">
                                {row.tenantFullName ?? "Unknown Occupant"}
                              </p>
                              <p className="truncate text-[10px] text-zinc-500 dark:text-[#707070]">{tenancyRef(row.id)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-zinc-700 dark:text-[#d5d5d5]">
                          <p className="truncate text-[12px]">{address.line1}</p>
                          <p className="truncate text-[10px] text-zinc-500 dark:text-[#737373]">{address.line2}</p>
                        </td>
                        <td className="hidden px-3 py-3 font-mono text-[12px] font-medium text-zinc-900 md:table-cell dark:text-[#ebebeb]">
                          {gbp.format(row.monthlyRent ?? 0)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                              rowStatus === "Active" && "border-border dark:border-[#2f6c3e]/50 bg-background dark:bg-[#163121]/40 text-[#5ab875]",
                              rowStatus === "Pending" && "border-border dark:border-[#73641d]/50 bg-background dark:bg-[#392f12]/40 text-[#c7aa48]",
                              rowStatus === "Ending" && "border-border dark:border-[#93000a]/40 bg-background dark:bg-[#93000a]/10 text-[#ffdad6]",
                              rowStatus === "Onboarding" && "border-border dark:border-[#365488]/50 bg-background dark:bg-[#162238]/40 text-[#78a4f5]",
                            )}
                          >
                            {rowStatus}
                          </span>
                        </td>
                        <td className="hidden px-3 py-3 text-[11px] text-zinc-600 md:table-cell dark:text-[#7f7f7f]">
                          <div className="flex flex-col">
                            <span>{fmtShortDate(row.startDate)}</span>
                            <span className="text-[9px] opacity-60">to {fmtShortDate(row.endDate)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-[12px]">
                          {payment.ui === "arrears" ? (
                            <div className="flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-red-400 dark:bg-[#ffb4ab]" />
                              <span className="font-bold text-red-700 dark:text-[#ffb4ab]">{gbp.format(payment.arrears)} OWED</span>
                            </div>
                          ) : payment.ui === "paid" ? (
                            <div className="flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-[#5ab875]" />
                              <span className="text-emerald-700 dark:text-[#5ab875]">COLLECTED</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-zinc-400 dark:bg-[#707070]" />
                              <span className="text-zinc-600 dark:text-[#707070]">DUE: {gbp.format(paymentDue)}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <p className="px-3 pt-1 text-xs text-zinc-500 md:hidden dark:text-zinc-500">← Scroll to see more</p>
          </div>
        </div>

        {/* E. Actionability / Inspector Aside */}
        {inspectorOpen && (
          <aside className="hidden h-full min-h-0 w-[340px] shrink-0 flex-col overflow-hidden border-l border-zinc-200/80 bg-zinc-50 dark:border-[#232323] dark:bg-[#111111] lg:flex">
              <div className="shrink-0 border-b border-zinc-200/80 p-6 dark:border-[#232323]">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-[#6f6f6f]">Operational Inspector</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-[#8a8a8a] dark:hover:bg-background dark:bg-[#1a1a1a] dark:hover:text-[#e8e8e8]"
                    aria-label="Close panel"
                    onClick={() => setSelectedTenancyId(null)}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center border border-zinc-300 bg-zinc-100 text-[14px] font-bold text-zinc-900 dark:border-[#363636] dark:bg-[#212121] dark:text-[#e2e2e2]">
                    {initials(selected.tenantFullName)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold text-zinc-900 dark:text-white">
                      {selected.tenantFullName ?? "Unknown Occupant"}
                    </h2>
                    <p className="truncate font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                      REF: {tenancyRef(selected.id)}
                    </p>
                  </div>
                </div>
                
                {/* Primary Metadata Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/dashboard/tenants/${selected.tenantId}`}
                    className="border border-zinc-300 bg-zinc-100 py-2 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-[#2f2f2f] dark:bg-[#161616] dark:text-white dark:hover:bg-background dark:bg-[#202020]"
                  >
                    Tenant Profile
                  </Link>
                  <Link
                    href={`/dashboard/properties/${selected.propertyId}`}
                    className="border border-zinc-300 bg-zinc-100 py-2 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-900 transition-colors hover:bg-zinc-200 dark:border-[#2f2f2f] dark:bg-[#161616] dark:text-white dark:hover:bg-background dark:bg-[#202020]"
                  >
                    Property
                  </Link>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6">
                {/* 1. Daily Essentials Grid */}
                <section>
                  <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Operational Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Status</p>
                      <p className="text-xs font-bold uppercase text-zinc-900 dark:text-white">{selected.status}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Rent State</p>
                      <p className={cn(
                        "text-xs font-bold uppercase",
                        selectedPayment?.ui === "arrears" ? "text-red-600 dark:text-[#ffb4ab]" :
                        selectedPayment?.ui === "paid" ? "text-emerald-700 dark:text-[#5ab875]" : "text-zinc-900 dark:text-white"
                      )}>
                        {selectedPayment?.ui === "arrears" ? "Arrears" : 
                         selectedPayment?.ui === "paid" ? "Collected" : "Due"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Monthly Rent</p>
                      <p className="font-mono text-xs font-bold text-emerald-700 dark:text-[#afefdd]">
                        {gbp.format(selected.monthlyRent ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Expiry</p>
                      <p className="font-mono text-xs font-medium text-zinc-900 dark:text-white">
                        {fmtInspectorDate(selected.endDate)}
                      </p>
                    </div>
                  </div>
                </section>

                {/* 2. Secondary Context (Collapsed by default or simplified) */}
                <section className="border-t border-zinc-200/80 pt-6 dark:border-[#232323]">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Commencement</p>
                      <p className="font-mono text-[10px] text-zinc-400">
                        {fmtInspectorDate(selected.startDate)}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Deposit</p>
                      <p className="font-mono text-[10px] text-zinc-400">
                        {gbp.format(selected.depositAmount ?? 0)}
                      </p>
                    </div>
                  </div>
                </section>

                {/* 3. Recent Activity Log (Noise reduced) */}
                <section className="border-t border-zinc-200/80 pt-6 dark:border-[#232323]">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                      Recent History
                    </h3>
                  </div>
                  {inspectorActivityEntries.length === 0 ? (
                    <p className="font-mono text-[10px] text-zinc-600">
                      NO EVENTS LOGGED.
                    </p>
                  ) : (
                    <div className="space-y-4 font-mono text-[10px]">
                      {inspectorActivityEntries.slice(0, 2).map((entry) => (
                        <div key={entry.id} className="flex gap-3">
                          <div
                            className={cn(
                              "h-full w-0.5 shrink-0",
                              propertyInspectorActivityBarClass(entry.accent),
                            )}
                          />
                          <div className="min-w-0 flex flex-col gap-0.5">
                            <span className="text-zinc-600">{formatTenancyInspectorWhen(entry.at)}</span>
                            <span className="truncate text-zinc-700 dark:text-zinc-300">{entry.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Bottom Sticky Actions (Action Priority) */}
              <div className="shrink-0 border-t border-zinc-200/80 bg-white p-6 dark:border-[#232323] dark:bg-[#0B0B0B]">
                <div className="grid grid-cols-1 gap-2">
                  <Link
                    href={`/dashboard/tenancies/${selected.id}`}
                    className="flex items-center justify-center rounded-md border border-zinc-300 bg-white py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-[#1e1e1e] dark:text-zinc-200 dark:hover:bg-[#2a2a2a] dark:hover:text-white"
                  >
                    Open Full Case File
                  </Link>
                  <LogPaymentDialog
                    tenancyId={selected.id}
                    rentPaymentId={selectedPayment?.payment?.id}
                    defaultAmountPaid={
                      selectedPayment && selectedPayment.arrears > 0
                        ? selectedPayment.arrears
                        : selected.monthlyRent ?? 0
                    }
                    triggerLabel="Log Payment Action"
                    triggerClassName="w-full rounded-md border border-zinc-300 bg-transparent py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-[#333333] dark:text-zinc-200 dark:hover:bg-zinc-100 dark:bg-zinc-900"
                  />
                  
                  {/* Demoted Metadata Edit */}
                  <div className="mt-2 flex justify-center">
                    <EditTenancyDialog
                      tenancyId={selected.id}
                      userId={userId ?? ""}
                      initial={{
                        startDate: selected.startDate,
                        endDate: selected.endDate,
                        moveInDate: selected.moveInDate,
                        monthlyRent: selected.monthlyRent,
                        depositAmount: selected.depositAmount,
                        status: selected.status,
                      }}
                      triggerLabel="Edit Parameters"
                      triggerClassName="text-[8px] font-bold uppercase tracking-widest text-zinc-700 hover:text-zinc-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
          </aside>
        )}
      </div>
    </div>
  );
}
