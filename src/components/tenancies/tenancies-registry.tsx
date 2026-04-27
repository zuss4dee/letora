"use client";

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
import { CheckCircle2, Circle, Ellipsis, Hourglass, MinusCircle, Plus, X } from "lucide-react";
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
}: {
  tenancies: TenancyRow[];
  paymentsThisMonth: RentPaymentRow[];
  userId: string | null;
  propertyOptions: Array<{ id: string; label: string }>;
  tenantOptions: Array<{ id: string; label: string }>;
  activityByTenancyId: Record<string, TenancyInspectorActivityEntry[]>;
  onboardingTasksByTenancyId: TenancyOnboardingTasksByTenancyId;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "onboarding" | "overdue">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date_added_desc");
  const [columnPrefs, setColumnPrefs] = useState<TenancyColumnPrefs>(() => readTenancyColumnPrefs());
  const [addTenancyOpen, setAddTenancyOpen] = useState(false);
  const [selectedTenancyId, setSelectedTenancyId] = useState<string | null>(tenancies[0]?.id ?? null);
  const [activityLogExpandedByTenancyId, setActivityLogExpandedByTenancyId] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    try {
      localStorage.setItem(TENANCIES_COLUMN_STORAGE_KEY, JSON.stringify(columnPrefs));
    } catch {
      /* ignore quota / private mode */
    }
  }, [columnPrefs]);

  const paymentByTenancy = useMemo(() => {
    const map = new Map<string, RentPaymentRow>();
    for (const payment of paymentsThisMonth) {
      const tenancyId = payment.tenancyId;
      if (!tenancyId || map.has(tenancyId)) continue;
      map.set(tenancyId, payment);
    }
    return map;
  }, [paymentsThisMonth]);

  const serverOrderIndex = useMemo(() => {
    const map = new Map<string, number>();
    tenancies.forEach((row, index) => map.set(row.id, index));
    return map;
  }, [tenancies]);

  const sortedRows = useMemo(() => {
    const copy = [...tenancies];
    switch (sortKey) {
      case "date_added_desc":
        return copy.sort((a, b) => (serverOrderIndex.get(a.id) ?? 0) - (serverOrderIndex.get(b.id) ?? 0));
      case "date_added_asc":
        return copy.sort((a, b) => (serverOrderIndex.get(b.id) ?? 0) - (serverOrderIndex.get(a.id) ?? 0));
      case "start_date_desc":
        return copy.sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
      case "start_date_asc":
        return copy.sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
      default:
        return copy;
    }
  }, [tenancies, sortKey, serverOrderIndex]);

  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      const status = statusLabel(row.status).toLowerCase();
      const payment = paymentForTenancy(row.id, paymentByTenancy);
      const onboarding = onboardingProgress(row.onboardingStatus);
      if (filter === "all") return true;
      if (filter === "active") return status === "active";
      if (filter === "pending") return status === "pending";
      if (filter === "onboarding") return onboarding.pct < 100;
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

  const tableColCount =
    5 + (columnPrefs.moveInStage ? 1 : 0) + (columnPrefs.referencing ? 1 : 0);

  const selectedPayment = selected ? paymentForTenancy(selected.id, paymentByTenancy) : null;
  const selectedAddress = splitAddress(selected?.propertyAddress ?? null);
  const inspectorOpen = selected != null;

  const inspectorActivityEntries = useMemo(() => {
    const id = selected?.id;
    if (!id) return [];
    return activityByTenancyId[id] ?? [];
  }, [activityByTenancyId, selected?.id]);

  const activityLogExpanded = Boolean(selected?.id && activityLogExpandedByTenancyId[selected.id]);

  const visibleActivityEntries = useMemo(() => {
    if (activityLogExpanded) return inspectorActivityEntries;
    return inspectorActivityEntries.slice(0, TENANCY_ACTIVITY_COLLAPSED_COUNT);
  }, [activityLogExpanded, inspectorActivityEntries]);

  const activityLogHasMore = inspectorActivityEntries.length > TENANCY_ACTIVITY_COLLAPSED_COUNT;

  const inspectorOnboardingTasks = useMemo(() => {
    const id = selected?.id;
    if (!id) return [];
    return onboardingTasksByTenancyId[id] ?? [];
  }, [onboardingTasksByTenancyId, selected?.id]);

  const onboardingTasksCompleteCount = useMemo(
    () => inspectorOnboardingTasks.filter((t) => t.status === "complete").length,
    [inspectorOnboardingTasks],
  );

  const rtr = selected ? rightToRentLabel(selected.tenantRightToRentStatus) : { label: "PENDING", passed: false };

  return (
    <div className="flex min-h-0 flex-1 bg-[#0e0e0e] text-[#e5e2e1]">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          inspectorOpen && "border-r border-[#232323]",
        )}
      >
        <div className="flex items-center justify-between border-b border-[#232323] px-3 py-2">
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
                  "h-7 border px-3 text-[11px] font-medium",
                  filter === item.id
                    ? "border-[#3a3a3a] bg-[#1d1d1d] text-[#f2f2f2]"
                    : "border-transparent text-[#737373] hover:bg-[#1a1a1a] hover:text-[#c4c7c8]",
                )}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFilter("overdue")}
              className={cn(
                "flex h-7 items-center border px-3 text-[11px] font-medium",
                filter === "overdue"
                  ? "border-[#3a3a3a] bg-[#1d1d1d] text-[#ff8c8c]"
                  : "border-transparent text-[#ff6f6f] hover:bg-[#1a1a1a]",
              )}
            >
              <span className="mr-2 size-1.5 rounded-full bg-[#d75454]" />
              Overdue
            </button>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#7a7a7a]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="hover:text-[#c4c7c8]">
                  Sort by: {sortKeyTriggerLabel(sortKey)}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="hover:text-[#c4c7c8]">
                  Columns
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuCheckboxItem
                  checked={columnPrefs.moveInStage}
                  onCheckedChange={(value) =>
                    setColumnPrefs((p) => ({ ...p, moveInStage: value === true }))
                  }
                >
                  Move-in stage
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnPrefs.referencing}
                  onCheckedChange={(value) =>
                    setColumnPrefs((p) => ({ ...p, referencing: value === true }))
                  }
                >
                  Referencing
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={propertyOptions.length === 0 || tenantOptions.length === 0}
                  className="inline-flex h-7 items-center gap-1 border border-[#343434] bg-[#f5f5f5] px-2 text-[11px] font-semibold text-[#101010] disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  Quick Action
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem
                  disabled={propertyOptions.length === 0 || tenantOptions.length === 0}
                  onSelect={() => setAddTenancyOpen(true)}
                >
                  Add tenancy
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/approvals">Open approvals</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AddTenancyDialog
              properties={propertyOptions}
              tenants={tenantOptions}
              open={addTenancyOpen}
              onOpenChange={setAddTenancyOpen}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#111111] text-[10px] uppercase tracking-[0.08em] text-[#6f6f6f]">
              <tr className="border-b border-[#232323]">
                <th className="px-3 py-2 font-medium">Tenant</th>
                <th className="px-3 py-2 font-medium">Property</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Rent Due</th>
                <th className="px-3 py-2 font-medium">Arrears</th>
                {columnPrefs.moveInStage ? (
                  <th className="px-3 py-2 font-medium">Move-in Stage</th>
                ) : null}
                {columnPrefs.referencing ? (
                  <th className="px-3 py-2 font-medium">Referencing</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="text-[12px]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={tableColCount} className="px-3 py-10 text-center text-[12px] text-[#7b7b7b]">
                    No tenancies found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const address = splitAddress(row.propertyAddress);
                  const payment = paymentForTenancy(row.id, paymentByTenancy);
                  const onboarding = onboardingProgress(row.onboardingStatus);
                  const rowStatus = statusLabel(row.status);
                  const rowMoveInDate = row.moveInDate ?? row.startDate ?? null;
                  const isSelected = selected?.id === row.id;
                  const paymentDue =
                    payment.payment?.amountDue ??
                    payment.payment?.amountPaid ??
                    row.monthlyRent ??
                    0;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedTenancyId(row.id)}
                      className={cn(
                        "cursor-pointer border-b border-[#232323] hover:bg-[#1b1b1b]",
                        isSelected && "bg-[#1a1a1a]",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex size-5 items-center justify-center border border-[#353535] bg-[#202020] text-[10px] text-[#d0d0d0]">
                            {initials(row.tenantFullName)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium text-[#f0f0f0]">
                              {row.tenantFullName ?? "Unknown Tenant"}
                            </p>
                            <p className="truncate text-[10px] text-[#707070]">{tenancyRef(row.id)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-[12px] text-[#d5d5d5]">{address.line1}</p>
                        <p className="text-[10px] text-[#737373]">{address.line2}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "border px-2 py-0.5 text-[10px] uppercase",
                            rowStatus === "Active" && "border-[#2f6c3e]/50 bg-[#163121]/40 text-[#5ab875]",
                            rowStatus === "Pending" && "border-[#73641d]/50 bg-[#392f12]/40 text-[#c7aa48]",
                            rowStatus === "Ending" && "border-[#365488]/50 bg-[#162238]/40 text-[#78a4f5]",
                            rowStatus === "Onboarding" && "border-[#73641d]/50 bg-[#392f12]/40 text-[#c7aa48]",
                          )}
                        >
                          {rowStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-[#ebebeb]">
                        {gbp.format(paymentDue)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px]">
                        {payment.ui === "arrears" ? (
                          <span className="font-semibold text-[#d75454]">{gbp.format(payment.arrears)}</span>
                        ) : (
                          <span className="text-[#707070]">—</span>
                        )}
                      </td>
                      {columnPrefs.moveInStage ? (
                        <td className="px-3 py-2.5">
                          {onboarding.pct === 100 ? (
                            <span className="text-[11px] text-[#7f7f7f]">{fmtShortDate(rowMoveInDate)}</span>
                          ) : (
                            <div>
                              <div className="h-1 w-20 overflow-hidden bg-[#252525]">
                                <div className="h-full bg-[#d8d8d8]" style={{ width: `${onboarding.pct}%` }} />
                              </div>
                              <span className="mt-1 block text-[10px] text-[#7a7a7a]">
                                {onboarding.pct}% {onboarding.label}
                              </span>
                            </div>
                          )}
                        </td>
                      ) : null}
                      {columnPrefs.referencing ? (
                        <td className="px-3 py-2.5">
                          {onboarding.pct >= 52 ? (
                            <CheckCircle2 className="size-3.5 text-[#35bb61]" />
                          ) : onboarding.pct >= 20 ? (
                            <Hourglass className="size-3.5 text-[#a3a3a3]" />
                          ) : (
                            <Circle className="size-3.5 text-[#5f5f5f]" />
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {inspectorOpen ? (
        <aside className="hidden h-full min-h-0 w-[320px] shrink-0 flex-col overflow-hidden border-l border-[#232323] bg-[#111111] lg:flex">
            <div className="shrink-0 border-b border-[#232323] p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#6f6f6f]">Inspector</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-[#8a8a8a] hover:bg-[#1a1a1a] hover:text-[#e8e8e8]"
                  aria-label="Close panel"
                  onClick={() => setSelectedTenancyId(null)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center border border-[#363636] bg-[#212121] text-[12px] font-medium text-[#e2e2e2]">
                  {initials(selected.tenantFullName)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-[28px] leading-7 font-semibold text-white">
                    {selected.tenantFullName ?? "Unknown Tenant"}
                  </h2>
                  <p className="truncate text-[11px] text-[#8a8a8a]">
                    {selectedAddress.line1}, {selectedAddress.line2}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/dashboard/tenancies/${selected.id}`}
                  className="flex-1 border border-[#2f2f2f] bg-[#f5f5f5] py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[#111111]"
                >
                  Open Onboarding
                </Link>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center border border-[#333333] text-[#c0c0c0]"
                >
                  <Ellipsis className="size-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-5">
              <section>
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f6f6f]">
                  Tenancy Parameters
                </h3>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                  <div>
                    <p className="text-[10px] text-[#6f6f6f]">Commencement</p>
                    <p className="text-[12px] font-medium text-[#dddddd]">
                      {fmtInspectorDate(selected.startDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#6f6f6f]">Term Length</p>
                    <p className="text-[12px] font-medium text-[#dddddd]">
                      {termLength(selected.startDate, selected.endDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#6f6f6f]">Right to Rent</p>
                    <p
                      className={cn(
                        "flex items-center gap-1 text-[11px] font-semibold",
                        rtr.passed ? "text-[#35bb61]" : "text-[#c7aa48]",
                      )}
                    >
                      {rtr.passed ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <Hourglass className="size-3.5" />
                      )}
                      {rtr.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#6f6f6f]">Deposit</p>
                    <p className="text-[12px] font-medium text-[#dddddd]">
                      {gbp.format(selected.depositAmount ?? 0)}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f6f6f]">
                    Onboarding Flow
                  </h3>
                  {inspectorOnboardingTasks.length > 0 ? (
                    <span className="shrink-0 text-[10px] font-medium text-[#e5e5e5]">
                      {onboardingTasksCompleteCount}/{inspectorOnboardingTasks.length} TASKS
                    </span>
                  ) : null}
                </div>
                {inspectorOnboardingTasks.length > 0 ? (
                  <div className="space-y-2 text-[11px]">
                    {inspectorOnboardingTasks.map((task) => {
                      const done = task.status === "complete";
                      const skipped = task.status === "skipped";
                      return (
                        <div key={task.id} className="flex items-start gap-2">
                          {done ? (
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#35bb61]" />
                          ) : skipped ? (
                            <MinusCircle className="mt-0.5 size-3.5 shrink-0 text-[#8a8a8a]" />
                          ) : (
                            <Circle className="mt-0.5 size-3.5 shrink-0 text-[#5f5f5f]" />
                          )}
                          <div className="min-w-0">
                            <span
                              className={cn(
                                done ? "text-[#d4d4d4]" : skipped ? "text-[#8a8a8a]" : "text-[#777777]",
                              )}
                            >
                              {task.taskName.trim() || task.taskType}
                            </span>
                            {task.completedAt ? (
                              <p className="text-[10px] text-[#5f5f5f]">
                                {new Date(task.completedAt).toLocaleString("en-GB", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2 text-[11px] text-[#8a8a8a]">
                    <p>
                      Pipeline:{" "}
                      <span className="text-[#d4d4d4]">
                        {humanizeTenancyOnboardingStatus(selected.onboardingStatus)}
                      </span>
                    </p>
                    <p className="text-[10px] leading-relaxed text-[#6f6f6f]">
                      No onboarding checklist tasks are stored for this tenancy yet. Open onboarding for full detail.
                    </p>
                  </div>
                )}
              </section>

              <section>
                <div className="mb-4 flex items-start justify-between gap-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f6f6f]">
                    Activity Log
                  </h3>
                  <Link
                    href="/dashboard/activity"
                    className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-[#6f6f6f] underline-offset-4 hover:text-[#a3a3a3] hover:underline"
                  >
                    View all
                  </Link>
                </div>
                {inspectorActivityEntries.length === 0 ? (
                  <p className="text-[10px] text-[#6f6f6f]">
                    No recent rent, maintenance, referencing, or AI events linked to this tenancy.
                  </p>
                ) : (
                  <div className="font-mono text-[10px] text-[#e5e5e5]">
                    <div
                      className={cn(
                        "space-y-3",
                        !activityLogExpanded && TENANCY_ACTIVITY_COLLAPSED_LIST_MAX_CLASSES,
                      )}
                    >
                      {visibleActivityEntries.map((entry) => (
                        <div key={entry.id} className="flex gap-3">
                          <div
                            className={cn(
                              "h-full w-1 shrink-0",
                              propertyInspectorActivityBarClass(entry.accent),
                            )}
                          />
                          <div className="min-w-0 flex flex-col gap-1">
                            <span className="text-[#6f6f6f]">{formatTenancyInspectorWhen(entry.at)}</span>
                            <span className="break-words text-[#e8e8e8]">{entry.title}</span>
                            <span
                              className={cn(
                                entry.accent === "danger" ? "text-[#ff8c8c]" : "text-[#8a8a8a]",
                                entry.accent === "success" && "font-medium text-[#f0f0f0]",
                                !activityLogExpanded && TENANCY_ACTIVITY_DETAIL_COLLAPSED_CLASSES,
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
                          setActivityLogExpandedByTenancyId((prev) => {
                            const next = { ...prev };
                            if (next[id]) delete next[id];
                            else next[id] = true;
                            return next;
                          });
                        }}
                        className="mt-3 w-full pt-1 text-left text-[9px] font-semibold uppercase tracking-widest text-[#6f6f6f] hover:text-[#a3a3a3]"
                      >
                        {activityLogExpanded ? "Show less" : "Show more"}
                      </button>
                    ) : null}
                  </div>
                )}
              </section>
            </div>

            <div className="shrink-0 border-t border-[#232323] bg-[#111111] p-4">
              <div className="space-y-2">
                {userId ? (
                  <>
                    <LogPaymentDialog
                      tenancyId={selected.id}
                      rentPaymentId={selectedPayment?.payment?.id}
                      defaultAmountPaid={
                        selectedPayment && selectedPayment.arrears > 0
                          ? selectedPayment.arrears
                          : selected.monthlyRent ?? 0
                      }
                      triggerLabel="Draft Agreement"
                      triggerClassName="w-full border-[#3a3a3a] bg-[#212121] py-2 text-[11px] font-medium text-[#e8e8e8] hover:bg-[#292929]"
                    />
                    <EditTenancyDialog
                      tenancyId={selected.id}
                      userId={userId}
                      initial={{
                        startDate: selected.startDate,
                        endDate: selected.endDate,
                        moveInDate: selected.moveInDate,
                        monthlyRent: selected.monthlyRent,
                        depositAmount: selected.depositAmount,
                        status: selected.status,
                      }}
                      triggerLabel="View Tenant"
                      triggerClassName="w-full border-[#313131] bg-transparent py-2 text-[10px] text-[#a8a8a8] hover:border-[#454545] hover:text-[#d4d4d4]"
                    />
                  </>
                ) : null}
                <Link
                  href={
                    selected.propertyId
                      ? `/dashboard/properties/${selected.propertyId}`
                      : "/dashboard/properties"
                  }
                  className="block w-full border border-[#313131] py-2 text-center text-[10px] text-[#a8a8a8] hover:border-[#454545] hover:text-[#d4d4d4]"
                >
                  View Property
                </Link>
              </div>
            </div>
        </aside>
      ) : null}
    </div>
  );
}
