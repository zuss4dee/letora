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
      <span className="inline-flex items-center border border-[#21473c] bg-[#152420] px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider text-[#9ad7c3]">
        Paid
      </span>
    );
  }
  if (display === "overdue") {
    return (
      <span className="inline-flex items-center border border-[#4a2624] bg-[#271716] px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider text-[#ee8a85]">
        Overdue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center border border-[#4f3f23] bg-[#2c2417] px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider text-[#d0ad67]">
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
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#0f0f0f]">
      <div className="relative flex-1">
        <div className="mb-4 flex flex-col gap-4 border-b border-[#282828] bg-[#131313] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <nav className="flex flex-wrap items-center gap-6 font-[family-name:var(--font-inter)] text-[11px] uppercase tracking-wider text-[#8e8e8e]">
            <Link href="/dashboard" className="transition-colors hover:text-foreground">
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setTabAndNav("arrears", false)}
              className={cn(
                "transition-colors",
                tab === "arrears" && !upcomingOnly ? "text-[#BD9952]" : "hover:text-foreground",
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
                upcomingOnly ? "text-[#BD9952]" : "hover:text-foreground",
              )}
            >
              Upcoming
            </button>
          </nav>
        </div>

        <header className="flex flex-col gap-6 border-b border-[#282828] bg-[#131313] px-5 pb-6 pt-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-inter)] text-2xl font-semibold leading-none tracking-tight text-[#f3f3f3] sm:text-3xl">
              Rent Tracker
            </h1>
            <p className="mt-2 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#7e7e7e] sm:block">
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
                  className="border border-[#343434] bg-[#171717] px-5 py-2.5 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#d6d6d6] transition hover:border-[#c9c9c9] hover:text-white disabled:opacity-40"
                >
                  Record payment
                </button>
              }
            />
            <button
              type="button"
              onClick={() => downloadReportCsv(filtered, todayIso)}
              className="inline-flex items-center gap-2 border border-[#d4d4d4] bg-[#f0f0f0] px-5 py-2.5 font-[family-name:var(--font-inter)] text-[11px] font-bold uppercase tracking-[0.15em] text-[#222] transition hover:bg-white"
            >
              Generate report
              <Download className="size-4" aria-hidden />
            </button>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-px border-y border-[#282828] bg-[#282828] md:grid-cols-4">
          <div className="flex h-28 flex-col justify-between bg-[#161616] p-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7d7d7d]">
              Total expected
            </span>
            <span className="font-mono text-[24px] text-[#ededed]">
              {gbp.format(stats.expectedThisMonth)}
            </span>
          </div>
          <div className="relative flex h-28 flex-col justify-between overflow-hidden bg-[#161616] p-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7d7d7d]">
                Collected
              </span>
              <span className="mt-1 block font-mono text-[24px] text-[#ededed]">
                {gbp.format(stats.receivedThisMonth)}
              </span>
            </div>
            <div className="mt-3 h-px w-full bg-[#2a2a2a]">
              <div
                className="h-full bg-[#d0ad67] transition-all"
                style={{ width: `${collectionPct}%` }}
              />
            </div>
            <span className="absolute bottom-4 right-4 font-mono text-[10px] font-bold text-[#d0ad67]">
              {collectionPct.toFixed(0)}%
            </span>
          </div>
          <div className="flex h-28 flex-col justify-between border-l border-[#4b2624] bg-[#161616] p-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d17b76]">
              Arrears
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[24px] text-[#ee8a85]">
                {gbp.format(stats.arrearsAmount)}
              </span>
              <span className="font-mono text-[10px] font-bold text-[#a85f5b]">
                {stats.overdueCount} units
              </span>
            </div>
          </div>
          <div className="flex h-28 flex-col justify-between bg-[#161616] p-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7d7d7d]">
              Next 30 days forecast
            </span>
            <span className="font-mono text-[24px] text-[#ededed]">
              {gbp.format(stats.forecastNext30Days)}
            </span>
          </div>
        </section>

        <div className="relative mb-6 flex flex-col gap-4 border border-[#2f2f2f] bg-[#171717] p-4 md:flex-row md:items-center md:gap-6">
          <div className="flex size-9 shrink-0 items-center justify-center border border-[#4f3f23] bg-[#2c2417] text-[#d0ad67]">
            <Sparkles className="size-5" strokeWidth={1.25} aria-hidden />
          </div>
          <div>
            <h1 className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#d0ad67]">
              Portfolio intelligence insight
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-[#a4a4a4]">
              Collection velocity across{" "}
              <span className="text-[#ededed]">{insightHighlight}</span> has stabilised with automated
              reminders. Arrears are projected to compress as upcoming instalments clear in the next
              cycle.
            </p>
          </div>
        </div>

        <section className="space-y-5 px-5 pb-8">
          <div className="flex flex-col gap-4 border-b border-[#282828] pb-4 md:flex-row md:items-center md:justify-between">
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
                    "pb-4 font-[family-name:var(--font-inter)] text-[11px] uppercase tracking-widest transition-colors",
                    tab === id && !upcomingOnly
                      ? "border-b-2 border-[#d0ad67] font-bold text-[#ededed]"
                      : "text-[#8e8e8e] hover:text-[#ededed]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#7f7f7f]">
                Filter by
              </span>
              <select
                value={propertyFilter}
                onChange={(e) => {
                  setPropertyFilter(e.target.value);
                  setPage(1);
                }}
                className="cursor-pointer border border-[#303030] bg-[#171717] px-2 py-1 font-[family-name:var(--font-inter)] text-[11px] uppercase tracking-wider text-[#d5d5d5] focus:outline-none"
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

          <div className="overflow-hidden border border-[#282828] bg-[#151515]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#282828] bg-[#161616]">
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#7b7b7b]">
                      Tenant
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#7b7b7b]">
                      Property
                    </th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-[#7b7b7b]">
                      Monthly rent
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#7b7b7b]">
                      Due date
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#7b7b7b]">
                      Status
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#7b7b7b]">
                      Last payment
                    </th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-[#7b7b7b]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-16 text-center font-[family-name:var(--font-inter)] text-sm text-[#8f8f8f]"
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
                          className="group border-b border-[#242424] transition-colors hover:bg-[#1b1b1b]"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex size-7 shrink-0 items-center justify-center border border-[#3a3a3a] bg-[#1d1d1d] font-mono text-[10px] font-medium text-[#d8d8d8]">
                                {initials(p.tenantName)}
                              </div>
                              <span className="text-sm font-medium text-[#efefef]">
                                {p.tenantName ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td className="max-w-[220px] px-4 py-4">
                            <span className="text-xs text-[#9a9a9a]">{p.propertyAddress ?? "—"}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right">
                            <span className="font-mono text-sm text-[#efefef]">
                              {gbp.format(p.amount)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <span
                              className={cn(
                                "text-xs",
                                dueOverdue ? "text-[#ee8a85]" : "text-[#a0a0a0]",
                              )}
                            >
                              {formatDisplayDate(p.due_date)}
                            </span>
                          </td>
                          <td className="px-4 py-4">{statusPill(display)}</td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <span className="text-xs text-[#a0a0a0]">
                              {p.paid_date ? formatDisplayDate(p.paid_date) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {showMarkPaid ? (
                                <button
                                  type="button"
                                  disabled={busyId === p.id}
                                  onClick={() =>
                                    void run(p.id, () => markRentPaid(p.id, todayIso))
                                  }
                                  className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#d0ad67] hover:underline disabled:opacity-50"
                                >
                                  Mark paid
                                </button>
                              ) : null}
                              {showMarkOverdue ? (
                                <button
                                  type="button"
                                  disabled={busyId === p.id}
                                  onClick={() => void run(p.id, () => markRentOverdue(p.id))}
                                  className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#9b9b9b] hover:text-[#d0ad67] disabled:opacity-50"
                                >
                                  Mark overdue
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={busyId === p.id}
                                onClick={() => void run(p.id, () => deleteRentPayment(p.id))}
                                className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#9b9b9b] hover:text-[#ee8a85] disabled:opacity-50"
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

          <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#7f7f7f]">
              Showing {displayFrom} to {displayTo} of {totalFiltered} payments
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex size-8 items-center justify-center border border-[#303030] bg-[#171717] text-[#9e9e9e] transition hover:border-[#d0ad67] hover:text-[#efefef] disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="flex size-8 items-center justify-center border border-[#303030] bg-[#171717] text-[#9e9e9e] transition hover:border-[#d0ad67] hover:text-[#efefef] disabled:opacity-30"
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
