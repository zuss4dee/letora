"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, UserPlus } from "lucide-react";

import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { cn } from "@/lib/utils";
import type { TenantRentStatus, TenantRow } from "@/lib/actions/tenants";

const PAGE_SIZE = 10;

type TabId = "active" | "arrears" | "move_ins" | "renewals";

function initials(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatMonthYear(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(d);
}

function leaseTermLine(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  return `${formatMonthYear(start)} - ${formatMonthYear(end)}`;
}

function leaseDurationLabel(months: number | null): string {
  if (months == null || months <= 0) return "—";
  return `${months} month${months === 1 ? "" : "s"} lease`;
}

const ONBOARDING_IN_FLIGHT = new Set([
  "not_started",
  "in_progress",
  "references",
  "contract_sent",
  "pending_signature",
]);

function needsRenewalSoon(endIso: string | null, withinDays = 90): boolean {
  if (!endIso) return false;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return false;
  const now = new Date();
  const limit = new Date(now);
  limit.setDate(limit.getDate() + withinDays);
  return end <= limit && end >= now;
}

function filterTenants(tab: TabId, rows: TenantRow[]): TenantRow[] {
  switch (tab) {
    case "active":
      return rows.filter((r) => {
        const s = (r.tenancyStatus ?? "").toLowerCase();
        return !r.tenancyId || s === "active";
      });
    case "arrears":
      return rows.filter((r) => r.rentStatus === "overdue");
    case "move_ins":
      return rows.filter((r) => ONBOARDING_IN_FLIGHT.has((r.onboardingStatus ?? "").toLowerCase()));
    case "renewals":
      return rows.filter((r) => needsRenewalSoon(r.leaseEndDate));
    default:
      return rows;
  }
}

function RentStatusPill({ status }: { status: TenantRentStatus }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b7f8e6]/10 px-3 py-1 font-[family-name:var(--font-inter)] text-[11px] font-bold uppercase tracking-wider text-[#afefdd]">
        <span className="size-1 rounded-full bg-[#e6fff6]" aria-hidden />
        Paid
      </span>
    );
  }
  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7f2927]/10 px-3 py-1 font-[family-name:var(--font-inter)] text-[11px] font-bold uppercase tracking-wider text-[#BB5551]">
        <span className="size-1 rounded-full bg-[#ee7d77]" aria-hidden />
        Overdue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4f3700]/10 px-3 py-1 font-[family-name:var(--font-inter)] text-[11px] font-bold uppercase tracking-wider text-[#e1ba70]">
      <span className="size-1 rounded-full bg-[#BD9952]" aria-hidden />
      Pending
    </span>
  );
}

const tabs: { id: TabId; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "arrears", label: "Arrears" },
  { id: "move_ins", label: "Move-ins" },
  { id: "renewals", label: "Renewals" },
];

export function TenantRegistry({ tenants }: { tenants: TenantRow[] }) {
  const [tab, setTab] = useState<TabId>("active");
  const [page, setPage] = useState(0);

  const totalActive = useMemo(
    () => tenants.filter((r) => (r.tenancyStatus ?? "").toLowerCase() === "active").length,
    [tenants],
  );
  const pendingReview = useMemo(
    () =>
      tenants.filter(
        (r) =>
          (r.rightToRentStatus ?? "").toLowerCase() === "pending" ||
          ONBOARDING_IN_FLIGHT.has((r.onboardingStatus ?? "").toLowerCase()),
      ).length,
    [tenants],
  );

  const filtered = useMemo(() => filterTenants(tab, tenants), [tab, tenants]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const safePage = Math.min(page, pageCount - 1);
  const sliceStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(sliceStart, sliceStart + PAGE_SIZE);

  return (
    <div className="relative min-h-0 flex-1 bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-2 sm:px-6 md:px-12 md:pb-28">
        <header className="mb-6 max-w-6xl md:mb-12">
          <h1 className="font-headline mb-2 text-2xl font-extralight tracking-tight text-foreground sm:text-3xl md:text-5xl">
            Tenant Registry
          </h1>
          <p className="hidden max-w-xl font-[family-name:var(--font-inter)] font-light tracking-wide text-muted-foreground sm:block">
            Curating the residency lifecycle across your premium portfolio with clinical precision and oversight.
          </p>
        </header>

        <div className="mb-6 flex max-w-6xl flex-col items-end justify-between gap-4 md:mb-8 md:flex-row md:gap-6">
          <div className="flex w-full flex-nowrap items-center gap-4 overflow-x-auto md:flex-wrap md:gap-10">
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setPage(0);
                  }}
                  className={cn(
                    "relative py-2 font-[family-name:var(--font-inter)] text-sm tracking-wider transition-colors",
                    active
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground hover:text-[#BD9952]",
                  )}
                >
                  {t.label}
                  {active ? (
                    <span className="absolute bottom-0 left-0 h-px w-full bg-[#BD9952]" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="hidden w-full shrink-0 justify-end gap-12 md:flex md:w-auto">
            <div className="text-right">
              <p className="mb-1 font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-[0.15em] text-muted-foreground">
                Total active
              </p>
              <p className="font-headline text-2xl font-light text-foreground">
                {totalActive.toLocaleString("en-GB")}
              </p>
            </div>
            <div className="border-l border-[#484848]/20 pl-12 text-right">
              <p className="mb-1 font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-[0.15em] text-muted-foreground">
                Pending review
              </p>
              <p className="font-headline text-2xl font-light text-[#BD9952]">
                {pendingReview.toLocaleString("en-GB")}
              </p>
            </div>
          </div>
        </div>

        <ul className="space-y-3 md:hidden">
          {pageRows.length === 0 ? (
            <li className="rounded-sm bg-card px-4 py-10 text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
              No tenants in this view yet.
            </li>
          ) : (
            pageRows.map((row) => (
              <li key={`m-${row.id}`} className="rounded-sm bg-card p-4">
                <Link href={`/dashboard/tenants/${row.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-[family-name:var(--font-inter)] text-[11px] font-semibold text-foreground dark:border-[#484848]/30 dark:bg-[#474646] dark:text-[#d2d0cf]">
                        {initials(row.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-[family-name:var(--font-inter)] text-sm font-semibold text-foreground">
                          {row.fullName ?? "—"}
                        </p>
                        <p className="truncate font-[family-name:var(--font-inter)] text-xs font-light text-muted-foreground">
                          {row.propertyLine1 ?? row.propertyAddress ?? row.email ?? "—"}
                        </p>
                      </div>
                    </div>
                    <RentStatusPill status={row.rentStatus} />
                  </div>
                  <p className="mt-3 border-t border-border/60 pt-3 font-[family-name:var(--font-inter)] text-[11px] tracking-wide text-muted-foreground">
                    {leaseTermLine(row.leaseStartDate, row.leaseEndDate)} · {leaseDurationLabel(row.leaseMonths)}
                  </p>
                </Link>
              </li>
            ))
          )}
        </ul>

        <div className="hidden overflow-hidden rounded-sm bg-card md:block">
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-muted dark:bg-[#1F2020]">
                  <th className="px-8 py-5 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Tenant name
                  </th>
                  <th className="px-8 py-5 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Property
                  </th>
                  <th className="px-8 py-5 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Lease term
                  </th>
                  <th className="px-8 py-5 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Rent status
                  </th>
                  <th className="px-8 py-5 text-right font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-8 py-16 text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground"
                    >
                      No tenants in this view yet.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr
                      key={row.id}
                      className="group transition-colors duration-200 ease-out hover:bg-muted/70 dark:hover:bg-[#252626]"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-[family-name:var(--font-inter)] text-sm font-semibold text-foreground dark:border-[#484848]/30 dark:bg-[#474646] dark:text-[#d2d0cf]">
                            {initials(row.fullName)}
                          </div>
                          <div>
                            <p className="font-[family-name:var(--font-inter)] text-sm font-semibold text-foreground">
                              {row.fullName ?? "—"}
                            </p>
                            <p className="font-[family-name:var(--font-inter)] text-xs font-light text-muted-foreground">
                              {row.email ?? "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="font-[family-name:var(--font-inter)] text-sm text-foreground">
                          {row.propertyLine1 ?? row.propertyAddress ?? "—"}
                        </p>
                        <p className="font-[family-name:var(--font-inter)] text-[11px] tracking-wide text-muted-foreground">
                          {row.propertySubtitle ?? "—"}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="font-[family-name:var(--font-inter)] text-sm text-foreground">
                          {leaseTermLine(row.leaseStartDate, row.leaseEndDate)}
                        </p>
                        <p className="font-[family-name:var(--font-inter)] text-[11px] tracking-wide text-muted-foreground">
                          {leaseDurationLabel(row.leaseMonths)}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <RentStatusPill status={row.rentStatus} />
                      </td>
                      <td className="px-8 py-6 text-right">
                        <Link
                          href={`/dashboard/tenants/${row.id}`}
                          className="font-[family-name:var(--font-inter)] text-[11px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-[#BD9952]"
                        >
                          Quick view
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex max-w-6xl items-center justify-between gap-4">
          <p className="font-[family-name:var(--font-inter)] text-[11px] uppercase tracking-widest text-muted-foreground">
            {filtered.length === 0
              ? "No accounts in this view"
              : `Showing ${sliceStart + 1}-${Math.min(sliceStart + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString("en-GB")} premium accounts`}
          </p>
          <div className="flex gap-4">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="border border-border p-2 text-foreground transition-colors hover:bg-muted dark:hover:bg-[#1F2020] disabled:pointer-events-none disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-[18px]" aria-hidden />
            </button>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="border border-border p-2 text-foreground transition-colors hover:bg-muted dark:hover:bg-[#1F2020] disabled:pointer-events-none disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="size-[18px]" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <AddTenantDialog
        trigger={
          <button
            type="button"
            className="fixed bottom-10 right-6 z-40 hidden items-center gap-4 rounded-sm bg-gradient-to-br from-[#C9C6C5] to-[#474646] px-5 py-4 font-[family-name:var(--font-inter)] text-sm font-bold uppercase tracking-widest text-[#414040] shadow-2xl transition-all hover:brightness-110 md:bottom-12 md:right-12 md:flex"
          >
            <UserPlus className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
            Onboard tenant
          </button>
        }
      />
    </div>
  );
}
