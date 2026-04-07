"use client";

import { ChevronLeft, ChevronRight, Download, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AddRentPaymentDialog } from "@/components/rent-tracker/add-rent-payment-dialog";
import {
  deleteRentPayment,
  markRentOverdue,
  markRentPaid,
  type RentPaymentListRow,
} from "@/lib/actions/rent-tracker";
import type { RentTrackerSummaryStats } from "@/lib/rent-tracker-stats";
import type { TenancyRow } from "@/lib/actions/tenancies";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDisplayDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function getDisplayStatus(
  p: RentPaymentListRow,
  todayIso: string,
): "paid" | "overdue" | "pending" {
  const st = (p.status ?? "").toLowerCase();
  if (st === "paid") return "paid";
  if (st === "overdue") return "overdue";
  if (st === "pending" && p.due_date && p.due_date < todayIso) return "overdue";
  return "pending";
}

function statusPill(display: "paid" | "overdue" | "pending") {
  if (display === "paid") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#afefdd]/10 px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wider text-[#afefdd]">
        Paid
      </span>
    );
  }
  if (display === "overdue") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#BB5551]/15 px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wider text-[#ee7d77]">
        Overdue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[#BD9952]/12 px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wider text-[#BD9952]">
      Pending
    </span>
  );
}

export type RentTab = "all" | "paid" | "pending" | "arrears";

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function downloadReportCsv(rows: RentPaymentListRow[], todayIso: string) {
  const header = ["Tenant", "Property", "Monthly rent", "Due date", "Status", "Last payment"];
  const lines = [header.join(",")];
  for (const p of rows) {
    const disp = getDisplayStatus(p, todayIso);
    lines.push(
      [
        `"${(p.tenantName ?? "").replace(/"/g, '""')}"`,
        `"${(p.propertyAddress ?? "").replace(/"/g, '""')}"`,
        String(p.amount),
        p.due_date ?? "",
        disp,
        p.paid_date ?? "",
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `letora-rent-tracker-${todayIso}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RentTrackerRegistry({
  payments,
  stats,
  tenancies,
  todayIso,
}: {
  payments: RentPaymentListRow[];
  stats: RentTrackerSummaryStats;
  tenancies: TenancyRow[];
  todayIso: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<RentTab>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [page, setPage] = useState(1);

  const collectionPct =
    stats.expectedThisMonth > 0
      ? Math.min(100, (stats.receivedThisMonth / stats.expectedThisMonth) * 100)
      : payments.length === 0
        ? 100
        : 0;

  const propertyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of payments) {
      if (p.propertyAddress?.trim()) set.add(p.propertyAddress);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [payments]);

  const insightHighlight = useMemo(() => {
    const first = payments
      .map((p) => p.propertyAddress?.split(",")[0]?.trim())
      .find(Boolean);
    return first ?? "your portfolio";
  }, [payments]);

  const filtered = useMemo(() => {
    const horizon7 = addDaysIso(todayIso, 7);
    return payments.filter((p) => {
      const display = getDisplayStatus(p, todayIso);
      if (propertyFilter !== "all" && (p.propertyAddress ?? "") !== propertyFilter) {
        return false;
      }
      if (upcomingOnly) {
        const due = p.due_date;
        if (!due || due < todayIso || due > horizon7) return false;
      }
      if (tab === "all") return true;
      if (tab === "paid") return display === "paid";
      if (tab === "pending") return display === "pending";
      return display === "overdue";
    });
  }, [payments, tab, propertyFilter, upcomingOnly, todayIso]);

  const totalFiltered = filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const displayFrom = totalFiltered === 0 ? 0 : start + 1;
  const displayTo = Math.min(start + PAGE_SIZE, totalFiltered);

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
      toast.success("Updated.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  function setTabAndNav(next: RentTab, upcoming: boolean) {
    setTab(next);
    setUpcomingOnly(upcoming);
    setPage(1);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#0E0E0E]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 top-32 size-80 rounded-full bg-[#BD9952]/[0.04] blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl flex-1 px-6 pb-24 pt-6 md:px-12 md:pt-8">
        <div className="mb-8 flex flex-col gap-4 border-b border-[#484848]/15 pb-6 md:flex-row md:items-center md:justify-between">
          <nav className="flex flex-wrap items-center gap-6 font-[family-name:var(--font-inter)] text-xs uppercase tracking-wider text-[#ACABAA]">
            <Link href="/dashboard" className="transition-colors hover:text-[#E7E5E4]">
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setTabAndNav("arrears", false)}
              className={cn(
                "transition-colors",
                tab === "arrears" && !upcomingOnly ? "text-[#BD9952]" : "hover:text-[#E7E5E4]",
              )}
            >
              Arrears
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("all");
                setUpcomingOnly(true);
                setPage(1);
              }}
              className={cn(
                "transition-colors",
                upcomingOnly ? "text-[#BD9952]" : "hover:text-[#E7E5E4]",
              )}
            >
              Upcoming
            </button>
          </nav>
        </div>

        <header className="flex flex-col gap-6 border-b border-[#484848]/15 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-headline text-4xl font-extralight leading-none tracking-[-0.02em] text-[#C9C6C5] md:text-[3.5rem]">
              Rent Tracker
            </h1>
            <p className="mt-4 font-[family-name:var(--font-inter)] text-sm uppercase tracking-[0.2em] text-[#ACABAA]">
              Portfolio payment intelligence
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AddRentPaymentDialog
              tenancies={tenancies}
              trigger={
                <button
                  type="button"
                  disabled={tenancies.length === 0}
                  className="border border-[#484848]/25 px-5 py-2.5 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#C9C6C5] transition hover:border-[#BD9952]/40 hover:text-[#BD9952] disabled:opacity-40"
                >
                  Record payment
                </button>
              }
            />
            <button
              type="button"
              onClick={() => downloadReportCsv(filtered, todayIso)}
              className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-br from-[#C9C6C5] to-[#474646] px-6 py-3 font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.15em] text-[#414040] transition hover:opacity-90"
            >
              Generate report
              <Download className="size-4" aria-hidden />
            </button>
          </div>
        </header>

        <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex h-32 flex-col justify-between bg-[#131313] p-6 transition-colors hover:bg-[#1F2020]">
            <span className="font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#ACABAA]">
              Total expected
            </span>
            <span className="font-headline text-3xl font-light text-[#C9C6C5]">
              {gbp.format(stats.expectedThisMonth)}
            </span>
          </div>
          <div className="relative flex h-32 flex-col justify-between overflow-hidden bg-[#131313] p-6 transition-colors hover:bg-[#1F2020]">
            <div>
              <span className="font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#ACABAA]">
                Collected
              </span>
              <span className="mt-1 block font-headline text-3xl font-light text-[#C9C6C5]">
                {gbp.format(stats.receivedThisMonth)}
              </span>
            </div>
            <div className="mt-3 h-0.5 w-full bg-[#484848]/20">
              <div
                className="h-full bg-[#BD9952] transition-all"
                style={{ width: `${collectionPct}%` }}
              />
            </div>
            <span className="absolute bottom-6 right-6 font-[family-name:var(--font-inter)] text-[0.6rem] font-bold text-[#BD9952]">
              {collectionPct.toFixed(0)}%
            </span>
          </div>
          <div className="flex h-32 flex-col justify-between border-l border-[#BB5551]/20 bg-[#131313] p-6">
            <span className="font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#BB5551]">
              Arrears
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-3xl font-light text-[#BB5551]">
                {gbp.format(stats.arrearsAmount)}
              </span>
              <span className="font-[family-name:var(--font-inter)] text-[0.6rem] font-bold text-[#BB5551]/60">
                {stats.overdueCount} units
              </span>
            </div>
          </div>
          <div className="flex h-32 flex-col justify-between bg-[#131313] p-6 transition-colors hover:bg-[#1F2020]">
            <span className="font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#ACABAA]">
              Next 30 days forecast
            </span>
            <span className="font-headline text-3xl font-light text-[#C9C6C5]">
              {gbp.format(stats.forecastNext30Days)}
            </span>
          </div>
        </section>

        <div className="relative mb-8 flex flex-col gap-4 border-l border-[#BD9952]/30 bg-[#252626]/40 p-5 backdrop-blur-sm md:flex-row md:items-center md:gap-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#4f3700]/30 text-[#BD9952]">
            <Sparkles className="size-5" strokeWidth={1.25} aria-hidden />
          </div>
          <div>
            <h1 className="mb-1 font-[family-name:var(--font-inter)] text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-[#BD9952]">
              Portfolio intelligence insight
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-[#ACABAA]">
              Collection velocity across{" "}
              <span className="text-[#C9C6C5]">{insightHighlight}</span> has stabilised with automated
              reminders. Arrears are projected to compress as upcoming instalments clear in the next
              cycle.
            </p>
          </div>
          <div
            className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-[#BD9952]/40 to-transparent"
            aria-hidden
          />
        </div>

        <section className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-[#484848]/10 pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-8">
              {(
                [
                  ["all", "All payments"],
                  ["paid", "Paid"],
                  ["pending", "Pending"],
                  ["arrears", "Arrears"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTab(id);
                    setUpcomingOnly(false);
                    setPage(1);
                  }}
                  className={cn(
                    "pb-4 font-[family-name:var(--font-inter)] text-xs uppercase tracking-widest transition-colors",
                    tab === id && !upcomingOnly
                      ? "border-b-2 border-[#BD9952] font-bold text-[#C9C6C5]"
                      : "text-[#ACABAA] hover:text-[#E7E5E4]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-widest text-[#767575]">
                Filter by
              </span>
              <select
                value={propertyFilter}
                onChange={(e) => {
                  setPropertyFilter(e.target.value);
                  setPage(1);
                }}
                className="cursor-pointer border-0 bg-transparent font-[family-name:var(--font-inter)] text-xs uppercase tracking-wider text-[#ACABAA] focus:outline-none focus:ring-0"
                aria-label="Filter by property"
              >
                <option value="all">All properties</option>
                {propertyOptions.map((addr) => (
                  <option key={addr} value={addr}>
                    {addr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden bg-[#131313]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#484848]/10">
                    <th className="px-6 py-5 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#767575]">
                      Tenant
                    </th>
                    <th className="px-6 py-5 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#767575]">
                      Property
                    </th>
                    <th className="px-6 py-5 text-right font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#767575]">
                      Monthly rent
                    </th>
                    <th className="px-6 py-5 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#767575]">
                      Due date
                    </th>
                    <th className="px-6 py-5 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#767575]">
                      Status
                    </th>
                    <th className="px-6 py-5 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#767575]">
                      Last payment
                    </th>
                    <th className="px-6 py-5 text-right font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#767575]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-16 text-center font-[family-name:var(--font-inter)] text-sm text-[#ACABAA]"
                      >
                        No payments match this view. Add a payment or adjust filters.
                      </td>
                    </tr>
                  ) : (
                    slice.map((p) => {
                      const display = getDisplayStatus(p, todayIso);
                      const dbStatus = (p.status ?? "").toLowerCase();
                      const showMarkPaid = dbStatus !== "paid";
                      const showMarkOverdue = dbStatus === "pending";
                      const dueOverdue = display === "overdue";
                      return (
                        <tr
                          key={p.id}
                          className="group border-b border-[#484848]/5 transition-colors hover:bg-[#1F2020]/80"
                        >
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#474646]/40 font-[family-name:var(--font-inter)] text-[10px] font-medium text-[#C9C6C5]">
                                {initials(p.tenantName)}
                              </div>
                              <span className="text-sm font-medium text-[#C9C6C5]">
                                {p.tenantName ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td className="max-w-[220px] px-6 py-6">
                            <span className="text-xs text-[#ACABAA]">{p.propertyAddress ?? "—"}</span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-6 text-right">
                            <span className="font-headline text-sm text-[#C9C6C5]">
                              {gbp.format(p.amount)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-6">
                            <span
                              className={cn(
                                "text-xs",
                                dueOverdue ? "text-[#BB5551]" : "text-[#ACABAA]",
                              )}
                            >
                              {formatDisplayDate(p.due_date)}
                            </span>
                          </td>
                          <td className="px-6 py-6">{statusPill(display)}</td>
                          <td className="whitespace-nowrap px-6 py-6">
                            <span className="text-xs text-[#ACABAA]">
                              {p.paid_date ? formatDisplayDate(p.paid_date) : "—"}
                            </span>
                          </td>
                          <td className="px-6 py-6 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {showMarkPaid ? (
                                <button
                                  type="button"
                                  disabled={busyId === p.id}
                                  onClick={() =>
                                    void run(p.id, () => markRentPaid(p.id, todayIso))
                                  }
                                  className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#BD9952] hover:underline disabled:opacity-50"
                                >
                                  Mark paid
                                </button>
                              ) : null}
                              {showMarkOverdue ? (
                                <button
                                  type="button"
                                  disabled={busyId === p.id}
                                  onClick={() => void run(p.id, () => markRentOverdue(p.id))}
                                  className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#ACABAA] hover:text-[#BD9952] disabled:opacity-50"
                                >
                                  Mark overdue
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={busyId === p.id}
                                onClick={() => void run(p.id, () => deleteRentPayment(p.id))}
                                className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#767575] hover:text-[#ee7d77] disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-widest text-[#767575]">
              Showing {displayFrom} to {displayTo} of {totalFiltered} payments
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex size-8 items-center justify-center border border-[#484848]/20 text-[#ACABAA] transition hover:border-[#BD9952]/40 hover:text-[#C9C6C5] disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="flex size-8 items-center justify-center border border-[#484848]/20 text-[#ACABAA] transition hover:border-[#BD9952]/40 hover:text-[#C9C6C5] disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
