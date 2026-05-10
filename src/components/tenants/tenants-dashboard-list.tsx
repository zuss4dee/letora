"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Filter, Hourglass, Key, Plus, Users } from "lucide-react";

import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { TenantRow } from "@/lib/actions/tenants";
import { cn } from "@/lib/utils";

type StatusTone = "active" | "notice" | "onboarding";

type ListTab = "all" | "active" | "arrears" | "onboarding";

function mapTenantStatus(row: TenantRow): { label: string; tone: StatusTone } {
  const onboarding = (row.onboardingStatus ?? "").toLowerCase();
  if (
    onboarding === "not_started" ||
    onboarding === "in_progress" ||
    onboarding === "references" ||
    onboarding === "contract_sent" ||
    onboarding === "pending_signature"
  ) {
    return { label: "Onboarding", tone: "onboarding" };
  }

  const tenancy = (row.tenancyStatus ?? "").toLowerCase();
  if (tenancy === "notice" || tenancy === "ending" || tenancy === "ending_soon") {
    return { label: "Notice", tone: "notice" };
  }

  return { label: "Active", tone: "active" };
}

function complianceState(rightToRentStatus: string | null): "ok" | "pending" | "warning" {
  const s = (rightToRentStatus ?? "").toLowerCase();
  if (s === "verified") return "ok";
  if (s === "failed") return "warning";
  return "pending";
}

function arrearsLabel(row: TenantRow): { value: string; className: string } {
  if (row.rentStatus === "overdue") {
    return {
      value: "Arrears",
      className: "text-[#d27b73] dark:text-[#ffb4ab]",
    };
  }
  if (row.rentStatus === "pending") {
    return {
      value: "—",
      className: "text-zinc-500 dark:text-zinc-600",
    };
  }
  return {
    value: "£0.00",
    className: "text-zinc-800 dark:text-zinc-200",
  };
}

function initials(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

function statusPill(status: { label: string; tone: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[2px] border px-1.5 font-[family-name:var(--font-inter)] text-[9px] font-bold uppercase tracking-[0.08em]",
        status.tone === "active" &&
          "border-zinc-300/50 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
        status.tone === "notice" &&
          "border-amber-300/40 bg-amber-100 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200",
        status.tone === "onboarding" &&
          "border-sky-300/45 bg-sky-100 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200",
      )}
    >
      {status.label}
    </span>
  );
}

function applyTabFilter(rows: TenantRow[], tab: ListTab): TenantRow[] {
  switch (tab) {
    case "all":
      return rows;
    case "active":
      return rows.filter((t) => mapTenantStatus(t).tone === "active");
    case "arrears":
      return rows.filter((t) => t.rentStatus === "overdue");
    case "onboarding":
      return rows.filter((t) => mapTenantStatus(t).tone === "onboarding");
    default:
      return rows;
  }
}

function applySearchFilter(rows: TenantRow[], q: string): TenantRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((t) => {
    const name = (t.fullName ?? "").toLowerCase();
    const email = (t.email ?? "").toLowerCase();
    const prop = (t.propertyAddress ?? t.propertyLine1 ?? "").toLowerCase();
    return name.includes(needle) || email.includes(needle) || prop.includes(needle);
  });
}

const TAB_IDS: ListTab[] = ["all", "active", "arrears", "onboarding"];

const TAB_LABEL: Record<ListTab, string> = {
  all: "All",
  active: "Active",
  arrears: "Arrears",
  onboarding: "Onboarding",
};

export function TenantsDashboardList({ tenants }: { tenants: TenantRow[] }) {
  const sheetIsBottom = useMediaQuery("(max-width: 767px)");
  const [tab, setTab] = useState<ListTab>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [emptyAddOpen, setEmptyAddOpen] = useState(false);

  const total = tenants.length;
  const activeCount = tenants.filter((t) => mapTenantStatus(t).tone === "active").length;
  const noticeCount = tenants.filter((t) => mapTenantStatus(t).tone === "notice").length;
  const onboardingCount = tenants.filter((t) => mapTenantStatus(t).tone === "onboarding").length;

  const filtered = useMemo(() => {
    const byTab = applyTabFilter(tenants, tab);
    return applySearchFilter(byTab, searchQuery);
  }, [tenants, tab, searchQuery]);

  const displayed = filtered.slice(0, 12);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[3rem] flex-col gap-3 border-b border-zinc-200/70 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-[#161616] sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-[family-name:var(--font-inter)] text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl dark:text-white">
            Tenants
          </h1>
          <nav className="flex gap-1" role="tablist" aria-label="Tenant segments">
            {TAB_IDS.map((id) => {
              const selected = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  id={`tenants-tab-${id}`}
                  onClick={() => setTab(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1 text-[11px] transition-colors",
                    selected
                      ? "bg-zinc-200 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-white"
                      : "font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white",
                  )}
                >
                  {TAB_LABEL[id]}
                  {id === "arrears" ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-background dark:bg-[#ffb4ab]" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-[2px] border-zinc-300 bg-white px-3 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-200 dark:bg-zinc-800"
            onClick={() => setFiltersOpen(true)}
            aria-expanded={filtersOpen}
            aria-controls="tenants-filters-sheet"
          >
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-[2px] border border-zinc-300 bg-white px-3 text-[11px] font-medium text-zinc-800 shadow-none hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-[#2a2a2a] dark:hover:text-white [&_svg]:text-zinc-600 dark:[&_svg]:text-zinc-400"
            asChild
          >
            <Link href="/dashboard/tenancies" aria-label="Open tenancies workspace">
              <Key className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              View Tenancies
            </Link>
          </Button>
          <AddTenantDialog
            trigger={
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 rounded-[2px] bg-white px-3 text-[11px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Tenant
              </button>
            }
          />
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          id="tenants-filters-sheet"
          side={sheetIsBottom ? "bottom" : "right"}
          className={cn(
            "flex w-[min(100%,24rem)] flex-col gap-4 overflow-y-auto",
            sheetIsBottom && "max-h-[85vh] rounded-t-2xl",
          )}
        >
          <SheetHeader className="text-left">
            <SheetTitle className="font-[family-name:var(--font-inter)] text-base">Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-1">
            <Label htmlFor="tenants-search" className="text-xs text-zinc-600 dark:text-zinc-400">
              Search name, email, or property
            </Label>
            <Input
              id="tenants-search"
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
        </SheetContent>
      </Sheet>

      {total === 0 ? (
        <>
          <EmptyState
            icon={Users}
            title="No tenants yet"
            description="Add your first tenant to start managing your properties."
            actionLabel="Add Tenant"
            onAction={() => setEmptyAddOpen(true)}
            className="flex-1"
          />
          <AddTenantDialog open={emptyAddOpen} onOpenChange={setEmptyAddOpen} />
        </>
      ) : (
      <>
      <div className="flex-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table className="min-w-[640px] w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-zinc-50 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600 dark:bg-[#161616] dark:text-zinc-400">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="hidden w-8 px-4 py-2 md:table-cell">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded-none border-zinc-400 bg-transparent text-zinc-900 focus:ring-0 dark:border-zinc-700 dark:text-white"
                  aria-label="Select all tenants"
                />
              </th>
              <th className="px-4 py-2">
                Tenant Name
              </th>
              <th className="hidden px-4 py-2 md:table-cell">
                Property / Unit
              </th>
              <th className="px-4 py-2">
                Status
              </th>
              <th className="hidden px-4 py-2 md:table-cell">
                Contact
              </th>
              <th className="px-4 py-2 text-right">
                Arrears
              </th>
              <th className="hidden px-4 py-2 text-center md:table-cell">
                Compliance
              </th>
            </tr>
          </thead>
          <tbody className="text-sm text-zinc-800 dark:text-zinc-200">
            {displayed.map((row, idx) => {
              const status = mapTenantStatus(row);
              const arrears = arrearsLabel(row);
              const compliance = complianceState(row.rightToRentStatus);
              const propertyLabel = row.propertyAddress ?? row.propertyLine1 ?? "Unassigned property";
              const name = row.fullName ?? "Unknown tenant";

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "h-9 border-b border-zinc-200 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40",
                    idx === 0 && "bg-zinc-50/80 dark:bg-zinc-900/20",
                  )}
                >
                  <td className="hidden px-4 py-0 md:table-cell">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded-none border-zinc-400 bg-transparent text-zinc-900 focus:ring-0 dark:border-zinc-700 dark:text-white"
                      aria-label={`Select ${name}`}
                    />
                  </td>
                  <td className="px-4 py-0">
                    <Link
                      href={`/dashboard/tenants/${row.id}`}
                      className="group flex min-w-0 items-center gap-2.5 text-zinc-900 dark:text-zinc-100"
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
                        {initials(row.fullName)}
                      </span>
                      <span className="truncate font-[family-name:var(--font-inter)] text-[12px] font-medium group-hover:underline">
                        {name}
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-0 font-[family-name:var(--font-inter)] text-[12px] text-zinc-700 md:table-cell dark:text-zinc-300">
                    {propertyLabel}
                  </td>
                  <td className="px-4 py-0">{statusPill(status)}</td>
                  <td className="hidden px-4 py-0 font-[family-name:var(--font-inter)] text-[11px] text-zinc-600 md:table-cell dark:text-zinc-400">
                    {row.email ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-0 text-right font-mono text-[12px]",
                      arrears.className,
                    )}
                  >
                    {arrears.value}
                  </td>
                  <td className="hidden px-4 py-0 text-center md:table-cell">
                    {compliance === "ok" ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" aria-hidden />
                    ) : compliance === "warning" ? (
                      <AlertTriangle className="mx-auto h-4 w-4 text-amber-500" aria-hidden />
                    ) : (
                      <Hourglass className="mx-auto h-4 w-4 text-zinc-500 dark:text-yellow-500" aria-hidden />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center font-[family-name:var(--font-inter)] text-sm text-zinc-600 dark:text-zinc-400">
            No tenants match this view.
          </p>
        ) : null}
      </div>
      <p className="px-4 pt-1 text-xs text-zinc-500 md:hidden dark:text-zinc-500">← Scroll to see more</p>

      <div className="flex min-h-8 flex-col gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-[10px] text-zinc-600 dark:border-zinc-800 dark:bg-[#131313] dark:text-zinc-400 sm:h-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Showing {Math.min(12, filtered.length)} of {filtered.length} in view
          {total !== filtered.length ? ` (${total} total)` : ""}
        </div>
        <div className="flex flex-wrap gap-4">
          <span>Active: {activeCount}</span>
          <span>Notice: {noticeCount}</span>
          <span>Onboarding: {onboardingCount}</span>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
