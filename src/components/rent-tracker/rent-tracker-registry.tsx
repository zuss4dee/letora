"use client";

import { Download, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { AgentApprovalRow } from "@/lib/approvals/types";
import { markRentPaid, type RentPaymentListRow } from "@/lib/actions/rent-tracker";
import type { LateRentChaseUiState } from "@/lib/dashboard/late-rent-chase-status";
import type { RentTrackerSummaryStats } from "@/lib/rent-tracker-stats";
import { isPaymentOverdue } from "@/lib/rent-payment-helpers";
import { applyRentTrackerDisplayMode, type RentTrackerResolvedDisplayMode } from "@/lib/rent-tracker-url-mode";
import { cn } from "@/lib/utils";

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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function calculateDaysLate(dueDateIso: string | null, todayIso: string): number | null {
  if (!dueDateIso) return null;
  const d1 = new Date(dueDateIso).getTime();
  const d2 = new Date(todayIso).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return null;
  const diff = d2 - d1;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : null;
}

function getDisplayStatus(
  p: RentPaymentListRow,
  todayIso: string,
): "paid" | "overdue" | "due_soon" | "pending" | "partial" {
  const st = (p.status ?? "").toLowerCase();
  if (st === "paid") return "paid";
  if (st === "partial") return "partial";
  if (st === "overdue") return "overdue";
  if (st === "pending" && p.due_date && p.due_date < todayIso) return "overdue";

  if (p.due_date) {
    const daysUntilDue = -1 * (calculateDaysLate(p.due_date, todayIso) ?? 0);
    if (daysUntilDue >= 0 && daysUntilDue <= 3) return "due_soon";
  }

  return "pending";
}

function StatusPill({ status }: { status: ReturnType<typeof getDisplayStatus> }) {
  if (status === "overdue") {
    return (
      <span className="bg-red-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-red-900 dark:bg-[#93000a] dark:text-white">
        OVERDUE
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-zinc-700 dark:bg-[#464747] dark:text-[#b5b5b5]">
        PARTIAL
      </span>
    );
  }
  if (status === "due_soon") {
    return (
      <span className="border border-zinc-200 bg-white px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-zinc-600 dark:border-[#282828] dark:bg-[#161616] dark:text-[#888888]">
        DUE SOON
      </span>
    );
  }
  if (status === "paid") {
    return (
      <span className="border border-green-700/30 bg-green-950/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-green-900 dark:border-[#21473c] dark:bg-[#152420] dark:text-[#9ad7c3]">
        PAID
      </span>
    );
  }
  return (
    <span className="border border-zinc-200 bg-white px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-zinc-600 dark:border-[#282828] dark:bg-[#161616] dark:text-[#888888]">
      PENDING
    </span>
  );
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

function getAgentState(row: RentPaymentListRow, pendingApprovals: AgentApprovalRow[]) {
  const approval = pendingApprovals.find((a) => a.target_id === row.id);
  if (approval)
    return { label: "DRAFT READY", tone: "emerald" as const, approvalId: approval.id, approval };
  if (row.status === "paid") return { label: "SETTLED", tone: "zinc" as const };
  return { label: "PENDING", tone: "zinc" as const };
}

function ChaseStatusCell({
  row,
  todayIso,
  chaseStatusByPaymentId,
}: {
  row: RentPaymentListRow;
  todayIso: string;
  chaseStatusByPaymentId: Record<string, LateRentChaseUiState>;
}) {
  if (!isPaymentOverdue(row.status, row.due_date, todayIso)) {
    return <span className="font-mono text-[11px] tabular-nums text-zinc-600">—</span>;
  }
  const state = chaseStatusByPaymentId[row.id] ?? "awaiting_agent";
  const config: Record<
    LateRentChaseUiState,
    { label: string; className: string }
  > = {
    chased: {
      label: "CHASED",
      className:
        "border-green-700/25 bg-green-100 text-green-800 dark:border-emerald-500/35 dark:bg-emerald-950/60 dark:text-[#9ad7c3]",
    },
    chase_pending: {
      label: "CHASE PENDING",
      className:
        "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
    },
    awaiting_agent: {
      label: "AWAITING AGENT",
      className:
        "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-[#333333] dark:bg-[#161616] dark:text-zinc-400",
    },
    no_action: {
      label: "NO ACTION",
      className:
        "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-[#333333] dark:bg-[#141414] dark:text-zinc-600",
    },
  };
  const c = config[state];
  return (
    <span
      className={cn(
        "inline-block border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}

export function RentTrackerRegistry({
  payments,
  stats,
  todayIso,
  pendingApprovals,
  focusPaymentId,
  canonicalRentTrackerMode,
  rentTrackerPreserveHref,
  chaseStatusByPaymentId,
  onMarkPaidSuccess,
}: {
  payments: RentPaymentListRow[];
  stats: RentTrackerSummaryStats;
  todayIso: string;
  pendingApprovals: AgentApprovalRow[];
  focusPaymentId?: string;
  canonicalRentTrackerMode: RentTrackerResolvedDisplayMode;
  rentTrackerPreserveHref: string;
  chaseStatusByPaymentId: Record<string, LateRentChaseUiState>;
  onMarkPaidSuccess?: () => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(payments[0]?.id ?? null);
  const [query, setQuery] = useState("");

  const { displayPayments } = useMemo(
    () =>
      applyRentTrackerDisplayMode(
        payments,
        canonicalRentTrackerMode,
        todayIso,
        focusPaymentId?.trim(),
      ),
    [payments, canonicalRentTrackerMode, todayIso, focusPaymentId],
  );

  useEffect(() => {
    const focused = focusPaymentId?.trim();

    if (displayPayments.length === 0) {
      setSelectedId(null);
      return;
    }

    if (focused && displayPayments.some((p) => p.id === focused)) {
      setQuery("");
      setSelectedId(focused);
      return;
    }

    setSelectedId((current) =>
      current != null && displayPayments.some((p) => p.id === current)
        ? current
        : (displayPayments[0]?.id ?? null),
    );
  }, [displayPayments, focusPaymentId]);

  useLayoutEffect(() => {
    const id = focusPaymentId?.trim();
    if (!id || selectedId !== id) return;
    const safe = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(id) : id;
    const el = document.querySelector(`[data-payment-row="${safe}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusPaymentId, selectedId, displayPayments]);

  async function handleMarkAsPaid(id: string) {
    setBusyId(id);
    try {
      await markRentPaid(id, todayIso);
      toast.success("Payment marked as paid", { duration: 2500 });
      onMarkPaidSuccess?.();
      setSelectedId(null);
      setTimeout(() => {
        router.refresh();
      }, 400);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return displayPayments;
    return displayPayments.filter((p) => {
      const hay = [p.tenantName, p.propertyAddress].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [displayPayments, query]);

  const selectedRow = useMemo(() => {
    return payments.find((p) => p.id === selectedId) ?? null;
  }, [payments, selectedId]);

  const historyRows = useMemo(() => {
    if (!selectedRow?.tenancyId) return [];
    return payments
      .filter((p) => p.tenancyId === selectedRow.tenancyId)
      .sort((a, b) => {
        const da = a.due_date ?? "";
        const db = b.due_date ?? "";
        return db.localeCompare(da);
      });
  }, [payments, selectedRow]);

  if (payments.length > 0 && displayPayments.length === 0) {
    return (
      <div className="flex min-h-[22rem] flex-col border border-zinc-200 dark:border-[#333333] bg-white dark:bg-[#161616]">
        <header className="flex items-center gap-2 border-b border-zinc-200 dark:border-[#282828] px-5 py-4 md:px-6">
          <span className="size-1.5 shrink-0 bg-zinc-500" aria-hidden />
          <h1 className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Rent operations</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">0 matching instalments</p>
          <p className="max-w-sm text-[13px] leading-relaxed text-zinc-400">
            Nothing in this roster matches the active Command Center filter for today&apos;s calendar window.
          </p>
          <Link
            href={rentTrackerPreserveHref}
            className="text-[11px] font-semibold text-[#afefdd] underline-offset-4 hover:underline"
          >
            Exit filtered view
          </Link>
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex min-h-[22rem] flex-col border border-zinc-200 dark:border-[#333333] bg-white dark:bg-[#161616]">
        <header className="flex items-center gap-2 border-b border-zinc-200 dark:border-[#282828] px-5 py-4 md:px-6">
          <span className="size-1.5 shrink-0 bg-zinc-500" aria-hidden />
          <h1 className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Rent operations</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">0 rent cases</p>
          <p className="max-w-sm text-[13px] leading-relaxed text-zinc-400">
            There are no rent payments to triage yet. Add a tenancy payment schedule or{" "}
            <Link href="/dashboard" className="text-[#afefdd] underline-offset-4 hover:underline">
              return to Command Center
            </Link>{" "}
            to continue the demo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-zinc-200 dark:border-[#333333] bg-white dark:bg-[#161616]">
      <header className="flex shrink-0 flex-col gap-3 border-b border-zinc-200 dark:border-[#282828] bg-white dark:bg-[#161616] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-1 size-1.5 shrink-0 bg-background dark:bg-[#afefdd]" aria-hidden />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Rent tracker</p>
            <h1 className="text-sm font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Rent operations</h1>
            <p className="mt-1 text-[11px] text-zinc-500">
              Arrears triage and collection workflow
              {pendingApprovals.length > 0 ? (
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-emerald-400/90">
                  · {pendingApprovals.length} chase draft{pendingApprovals.length === 1 ? "" : "s"} ready
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {canonicalRentTrackerMode !== "all" ? (
            <Link
              href={rentTrackerPreserveHref}
              className="flex h-8 items-center border border-zinc-200 dark:border-[#333333] bg-zinc-50 dark:bg-[#0B0B0B] px-3 text-[10px] font-bold uppercase tracking-wider text-emerald-800 transition-colors hover:border-zinc-400 hover:text-emerald-950 dark:text-[#afefdd] dark:hover:border-zinc-600 dark:hover:text-white"
            >
              Exit filtered view
            </Link>
          ) : null}
          <div className="relative min-w-[12rem] flex-1 md:w-64 md:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-full border border-zinc-200 dark:border-[#333333] bg-zinc-50 dark:bg-[#0B0B0B] pl-8 pr-3 text-[11px] text-zinc-900 placeholder-zinc-500 transition-colors focus:border-zinc-400 focus:outline-none dark:text-zinc-200 dark:placeholder-zinc-600 dark:focus:border-zinc-600"
              placeholder="Search tenants, properties…"
            />
          </div>
          <button
            type="button"
            onClick={() => downloadReportCsv(filtered, todayIso)}
            className="flex h-8 items-center gap-1.5 border border-zinc-200 dark:border-[#333333] bg-zinc-50 dark:bg-[#0B0B0B] px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-white"
          >
            <Download className="size-3.5" />
            Report
          </button>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-zinc-200 dark:border-[#282828] bg-zinc-200 dark:bg-[#282828] sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            label: "Expected (Mo)",
            value: gbp.format(stats.expectedThisMonth),
            body: "Active rent roll",
          },
          {
            label: "Collected (Mo)",
            value: gbp.format(stats.receivedThisMonth),
            tone: "emerald" as const,
            body: "Cash by paid date",
          },
          {
            label: "Outstanding (Mo)",
            value: gbp.format(stats.outstandingThisMonth),
            tone: stats.outstandingThisMonth > 0 ? ("amber" as const) : undefined,
            body: "Unpaid · due this month",
          },
          {
            label: "Arrears",
            value: gbp.format(stats.arrearsAmount),
            tone: "rose" as const,
            body: "Past-due balance",
          },
          {
            label: "Next unpaid (30d)",
            value: gbp.format(stats.nextUnpaidPipeline30d),
            body: "Due in horizon",
          },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col bg-zinc-50 dark:bg-[#0B0B0B] p-4">
            <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{stat.label}</span>
            <span
              className={cn(
                "text-lg font-bold tabular-nums tracking-tight",
                stat.tone === "rose" && stats.arrearsAmount > 0
                  ? "text-[#ffb4ab]"
                  : stat.tone === "emerald"
                    ? "text-[#afefdd]"
                    : stat.tone === "amber"
                      ? "text-amber-400"
                    : "text-zinc-900 dark:text-white",
              )}
            >
              {stat.value}
            </span>
            {stat.body ? (
              <span className="mt-1 text-[8px] font-mono uppercase tracking-wider text-zinc-600">{stat.body}</span>
            ) : null}
          </div>
        ))}
      </div>

      {canonicalRentTrackerMode !== "all" ? (
        <div className="flex shrink-0 items-start gap-2 border-b border-zinc-200 dark:border-[#282828] bg-zinc-100 dark:bg-[#141414] px-4 py-2 md:px-6">
          <span className="mt-1 size-1 shrink-0 rounded-[1px] bg-amber-500/75" aria-hidden />
          <p className="max-w-4xl font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-zinc-500">
            Summary KPIs reflect every instalment in your scoped roster (portfolio / deep-link). The instalment list
            below follows the active view filter only.
          </p>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden bg-zinc-50 dark:bg-[#0B0B0B]">
        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col border-zinc-200 dark:border-[#282828] bg-white dark:bg-[#161616]",
            selectedRow ? "border-r" : "",
          )}
        >
          <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b border-zinc-200 dark:border-[#282828] bg-white dark:bg-[#161616] px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 md:gap-4 md:px-6">
            <div className="col-span-4">Tenant · property</div>
            <div className="col-span-2 text-right">Rent due</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-2 text-center">Chase status</div>
            <div className="col-span-2 text-right">Agent</div>
          </div>

          <div className="min-h-0 flex-1 divide-y divide-zinc-200 dark:divide-[#282828] overflow-y-auto">
            {filtered.map((p) => {
              const isSelected = selectedId === p.id;
              const status = getDisplayStatus(p, todayIso);
              const daysLate = calculateDaysLate(p.due_date, todayIso);
              const agentState = getAgentState(p, pendingApprovals);

              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  data-payment-row={p.id}
                  onClick={() => setSelectedId(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(p.id);
                    }
                  }}
                  className={cn(
                    "grid cursor-pointer grid-cols-12 items-center gap-2 px-5 py-4 transition-colors hover:bg-zinc-100 md:gap-4 md:px-6 dark:hover:bg-background dark:bg-[#1c1c1c]",
                    isSelected ? "bg-zinc-100 dark:bg-[#141414] shadow-[inset_3px_0_0_0_#afefdd]" : "bg-transparent",
                  )}
                >
                  <div className="col-span-4 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">{p.tenantName}</span>
                      <span className="truncate text-[10px] text-zinc-500">· {p.propertyAddress}</span>
                    </div>
                    {status === "overdue" && daysLate ? (
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#ffb4ab]">
                        {daysLate} days overdue
                      </div>
                    ) : null}
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="font-mono text-[11px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {gbp.format(p.amount)}
                    </div>
                    <div className="text-[9px] uppercase tracking-tighter text-zinc-500">
                      Due {formatDisplayDate(p.due_date)}
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <StatusPill status={status} />
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <ChaseStatusCell
                      row={p}
                      todayIso={todayIso}
                      chaseStatusByPaymentId={chaseStatusByPaymentId}
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <span
                      className={cn(
                        "inline-block border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                        agentState.tone === "emerald"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-zinc-200 dark:border-[#333333] text-zinc-500",
                      )}
                    >
                      {agentState.label}
                    </span>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                  No rent cases match this search
                </p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-4 text-[11px] font-semibold text-[#afefdd] underline-offset-4 hover:underline"
                >
                  Clear search
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {selectedRow ? (
          <aside className="flex h-full w-full max-w-[22rem] shrink-0 flex-col overflow-hidden border-l border-zinc-200 dark:border-[#282828] bg-white dark:bg-[#161616] md:w-80">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 dark:border-[#282828] px-5 py-5 md:px-6">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Case detail</p>
                <h2 className="text-base font-bold uppercase tracking-tight text-zinc-900 dark:text-white">Rent case</h2>
              </div>
              <button
                type="button"
                className="rounded border border-transparent p-1 text-zinc-500 transition-colors hover:border-zinc-200 hover:text-zinc-900 dark:hover:border-border dark:border-[#333333] dark:hover:text-white"
                aria-label="Close detail"
                onClick={() => setSelectedId(null)}
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 md:px-6">
              <section>
                <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Context</h3>
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Tenant</p>
                    <p className="text-[12px] font-semibold text-zinc-900 dark:text-white">{selectedRow.tenantName}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Property</p>
                    <p className="text-[11px] text-zinc-300">{selectedRow.propertyAddress}</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Payment
                </h3>
                <div className="border border-zinc-200 dark:border-[#333333] bg-zinc-50 dark:bg-[#0B0B0B] p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Due</p>
                    <p className="font-mono text-xl font-bold text-zinc-900 dark:text-white">{gbp.format(selectedRow.amount)}</p>
                    </div>
                    {getDisplayStatus(selectedRow, todayIso) === "overdue" ? (
                      <div className="text-right">
                        <p className="mb-1 text-[9px] uppercase tracking-wider text-rose-500/60">Days late</p>
                        <p className="font-mono text-lg font-bold text-[#ffb4ab]">
                          {calculateDaysLate(selectedRow.due_date, todayIso)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              {getAgentState(selectedRow, pendingApprovals).label === "DRAFT READY" ? (
                <section>
                  <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Rent chase draft
                  </h3>
                  <div className="border border-emerald-900/30 bg-emerald-900/10 p-4 font-mono text-[11px]">
                    <div className="mb-3 border-b border-emerald-900/20 pb-3">
                      <span className="mr-2 text-[9px] uppercase text-emerald-500/60">Subject:</span>
                      <span className="text-emerald-100">
                        {(getAgentState(selectedRow, pendingApprovals).approval?.payload?.emailSubject as
                          | string
                          | undefined) ?? "—"}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-emerald-100/70">
                      {(getAgentState(selectedRow, pendingApprovals).approval?.payload?.emailBody as
                        | string
                        | undefined) ?? "No message body drafted."}
                    </div>
                  </div>
                </section>
              ) : null}

              <section>
                <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">History</h3>
                <div className="space-y-3">
                  {historyRows.slice(0, 5).map((hr) => {
                    const isPaid = hr.status === "paid";
                    return (
                      <div
                        key={hr.id}
                        className="flex items-center justify-between border-l border-zinc-200 dark:border-[#282828] py-1 pl-4"
                      >
                        <div>
                          <p className="text-[11px] font-bold text-zinc-900 dark:text-white">{formatDisplayDate(hr.due_date)}</p>
                          <p className="font-mono text-[10px] text-zinc-500">{gbp.format(hr.amount)}</p>
                        </div>
                        <span
                          className={cn(
                            "border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest",
                            isPaid
                              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                              : "border-rose-500/30 bg-rose-500/5 text-rose-400",
                          )}
                        >
                          {isPaid ? "Paid" : "Owed"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <footer className="shrink-0 space-y-2 border-t border-zinc-200 dark:border-[#282828] bg-zinc-50 dark:bg-[#0B0B0B] p-5 md:p-6">
              {getAgentState(selectedRow, pendingApprovals).label === "DRAFT READY" ? (
                <Button
                  asChild
                  className="w-full bg-emerald-600 py-6 text-[11px] font-bold uppercase tracking-[0.1em] text-[#ffffff] hover:bg-emerald-700"
                >
                  <Link
                    href={`/dashboard/approvals?id=${getAgentState(selectedRow, pendingApprovals).approvalId}`}
                  >
                    Review &amp; approve chase
                  </Link>
                </Button>
              ) : selectedRow.status !== "paid" ? (
                <Button
                  disabled={busyId === selectedRow.id}
                  onClick={() => void handleMarkAsPaid(selectedRow.id)}
                  className="w-full bg-white py-6 text-[11px] font-bold uppercase tracking-[0.1em] text-black hover:bg-zinc-200 disabled:opacity-50"
                >
                  Mark as paid
                </Button>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  asChild
                  variant="outline"
                  className="border-zinc-200 bg-transparent py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 hover:bg-zinc-100 dark:border-[#333333] dark:hover:bg-background dark:bg-[#161616]"
                >
                  <Link
                    href={
                      selectedRow.tenancyId
                        ? `/dashboard/tenancies/${selectedRow.tenancyId}`
                        : "#"
                    }
                  >
                    Tenancy
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-zinc-200 bg-transparent py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 hover:bg-zinc-100 dark:border-[#333333] dark:hover:bg-background dark:bg-[#161616]"
                >
                  <Link
                    href={
                      selectedRow.tenantId
                        ? `/dashboard/tenants/${selectedRow.tenantId}`
                        : "#"
                    }
                  >
                    Tenant
                  </Link>
                </Button>
              </div>
            </footer>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
