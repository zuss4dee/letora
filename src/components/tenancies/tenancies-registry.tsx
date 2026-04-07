"use client";

import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EditTenancyDialog } from "@/components/tenancies/edit-tenancy-dialog";
import { AddTenancyDialog } from "@/components/rent/add-tenancy-dialog";
import { LogPaymentDialog } from "@/components/rent/log-payment-dialog";
import type { RentPaymentRow, TenancyRow } from "@/lib/actions/tenancies";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function parseIsoDate(date: string | null) {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function classifyTenancy(endDateIso: string | null): "active" | "expiring" | "expired" {
  const now = new Date();
  const end = parseIsoDate(endDateIso);
  if (!end) return "active";
  if (end.getTime() < now.getTime()) return "expired";
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  if (end.getTime() - now.getTime() <= sixtyDaysMs) return "expiring";
  return "active";
}

function isTenancyActiveRow(t: TenancyRow): boolean {
  const st = (t.status ?? "active").toLowerCase();
  if (st === "ended") return false;
  return classifyTenancy(t.endDate) !== "expired";
}

function initials(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function tenantRefId(tenancyId: string, name: string | null): string {
  const compact = tenancyId.replace(/-/g, "").toUpperCase();
  const suf = initials(name);
  return `T-${compact.slice(0, 4)}-${suf}`;
}

function splitPropertyAddress(addr: string | null): { line1: string; line2: string | null } {
  if (!addr?.trim()) return { line1: "—", line2: null };
  const i = addr.indexOf(",");
  if (i === -1) return { line1: addr.trim(), line2: null };
  return {
    line1: addr.slice(0, i).trim(),
    line2: addr.slice(i + 1).trim() || null,
  };
}

type PaymentUi = "paid" | "arrears" | "pending";

function paymentForTenancy(
  tenancyId: string,
  map: Map<string, RentPaymentRow>,
): { ui: PaymentUi; arrears: number | null; payment: RentPaymentRow | null } {
  const p = map.get(tenancyId) ?? null;
  if (!p) {
    return { ui: "pending", arrears: null, payment: null };
  }
  const st = (p.status ?? "pending").toLowerCase();
  if (st === "paid") {
    return { ui: "paid", arrears: null, payment: p };
  }
  if (st === "overdue") {
    const due = p.amountDue ?? 0;
    const paid = p.amountPaid ?? 0;
    const owed = Math.max(0, due - paid);
    return { ui: "arrears", arrears: owed > 0 ? owed : due, payment: p };
  }
  return { ui: "pending", arrears: null, payment: p };
}

function isOnboardingPipelineComplete(t: TenancyRow): boolean {
  const ob = (t.onboardingStatus ?? "").trim().toLowerCase();
  return ob === "complete" || ob === "signed" || ob === "active";
}

function onboardingBar(t: TenancyRow): { label: string; pct: number; tone: "green" | "gold" | "teal" } {
  const ob = (t.onboardingStatus ?? "").trim().toLowerCase();

  /** DB pipeline: show full green bar when onboarding is finished or tenancy is live. */
  if (isOnboardingPipelineComplete(t)) {
    const label =
      ob === "active" ? "ACTIVE" : ob === "signed" ? "SIGNED" : "COMPLETE";
    return { label, pct: 100, tone: "green" };
  }

  if (ob === "not_started" || ob === "") {
    const st = (t.status ?? "active").toLowerCase();
    if (st === "pending") {
      return { label: "REFERENCING", pct: 42, tone: "gold" };
    }
    return { label: "NOT STARTED", pct: 10, tone: "gold" };
  }

  if (ob === "in_progress") {
    return { label: "IN PROGRESS", pct: 38, tone: "gold" };
  }
  if (ob === "references") {
    return { label: "REFERENCING", pct: 55, tone: "gold" };
  }
  if (ob === "contract_sent") {
    return { label: "CONTRACT SENT", pct: 78, tone: "gold" };
  }
  if (ob === "pending_signature") {
    return { label: "PENDING SIGN", pct: 90, tone: "gold" };
  }

  // Legacy rows without a known status: approximate from dates / tenancy status
  const st = (t.status ?? "active").toLowerCase();
  const now = new Date();
  const moveIn = parseIsoDate(t.moveInDate) ?? parseIsoDate(t.startDate);
  if (st === "pending") {
    return { label: "REFERENCING", pct: 42, tone: "gold" };
  }
  if (moveIn && moveIn.getTime() > now.getTime()) {
    return { label: "CONTRACT SENT", pct: 78, tone: "gold" };
  }
  return { label: "SIGNED", pct: 100, tone: "teal" };
}

function StatusBadge({ kind }: { kind: PaymentUi }) {
  const styles: Record<PaymentUi, string> = {
    paid: "border-emerald-500/40 text-[#afefdd]",
    arrears: "border-[#BB5551]/50 text-[#ee7d77]",
    pending: "border-[#484848]/50 text-[#ACABAA]",
  };
  const labels: Record<PaymentUi, string> = {
    paid: "PAID",
    arrears: "ARREARS",
    pending: "PENDING",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-sm border px-2 py-0.5 font-[family-name:var(--font-inter)] text-[0.6rem] font-semibold uppercase tracking-wider",
        styles[kind],
      )}
    >
      {labels[kind]}
    </span>
  );
}

export function TenanciesRegistry({
  tenancies,
  paymentsThisMonth,
  userId,
  propertyOptions,
  tenantOptions,
}: {
  tenancies: TenancyRow[];
  paymentsThisMonth: RentPaymentRow[];
  userId: string | null;
  propertyOptions: Array<{ id: string; label: string }>;
  tenantOptions: Array<{ id: string; label: string }>;
}) {
  const [page, setPage] = useState(1);

  const paymentByTenancy = useMemo(() => {
    const m = new Map<string, RentPaymentRow>();
    for (const p of paymentsThisMonth) {
      const tid = p.tenancyId;
      if (!tid) continue;
      if (!m.has(tid)) m.set(tid, p);
    }
    return m;
  }, [paymentsThisMonth]);

  const sorted = useMemo(
    () =>
      [...tenancies].sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "")),
    [tenancies],
  );

  const activeRows = useMemo(() => sorted.filter(isTenancyActiveRow), [sorted]);

  const kpis = useMemo(() => {
    const totalActive = activeRows.length;
    const payRows = paymentsThisMonth.filter((p) => p.tenancyId);
    const paidCount = payRows.filter((p) => (p.status ?? "").toLowerCase() === "paid").length;
    const overdueCount = payRows.filter((p) => (p.status ?? "").toLowerCase() === "overdue").length;
    const totalWithStatus = payRows.length;
    const collectionRate =
      totalWithStatus > 0 ? (paidCount / totalWithStatus) * 100 : 100;

    const monthlyRevenue = activeRows.reduce((sum, t) => sum + (t.monthlyRent ?? 0), 0);
    const forecast = monthlyRevenue * 1.03;

    const pendingOnboarding = activeRows.filter((t) => {
      if (isOnboardingPipelineComplete(t)) return false;
      const st = (t.status ?? "").toLowerCase();
      const moveIn = parseIsoDate(t.moveInDate) ?? parseIsoDate(t.startDate);
      const now = new Date();
      return st === "pending" || (moveIn !== null && moveIn.getTime() > now.getTime());
    }).length;

    const readySigning = activeRows.filter((t) => {
      const st = (t.status ?? "").toLowerCase();
      const moveIn = parseIsoDate(t.moveInDate) ?? parseIsoDate(t.startDate);
      const now = new Date();
      return st !== "pending" && moveIn !== null && moveIn.getTime() > now.getTime();
    }).length;

    return {
      totalActive,
      collectionRate,
      arrearsFlagged: overdueCount,
      monthlyRevenue,
      forecast,
      pendingOnboarding,
      readySigning,
    };
  }, [activeRows, paymentsThisMonth]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = sorted.slice(start, start + PAGE_SIZE);

  const displayFrom = total === 0 ? 0 : start + 1;
  const displayTo = Math.min(start + PAGE_SIZE, total);

  const forecastK = Math.round(kpis.forecast / 1000);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#0E0E0E]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 size-96 rounded-full bg-[#BD9952]/[0.03] blur-3xl" />
        <div className="absolute bottom-0 right-0 size-[28rem] rounded-full bg-[#1a1a1a]/80 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl flex-1 px-6 pb-24 pt-6 md:px-12 md:pt-8">
        <header className="flex flex-col gap-6 border-b border-[#484848]/15 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-headline text-3xl font-extralight tracking-tight text-[#E7E5E4] md:text-4xl">
              Tenancies
            </h1>
            <p className="mt-2 max-w-xl font-[family-name:var(--font-inter)] text-sm leading-relaxed text-[#ACABAA]">
              Manage onboarding, payments, and arrears for your premium portfolio across 12 jurisdictions.
            </p>
          </div>
          <AddTenancyDialog
            properties={propertyOptions}
            tenants={tenantOptions}
            trigger={
              <button
                type="button"
                disabled={propertyOptions.length === 0 || tenantOptions.length === 0}
                className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-r from-[#BD9952] via-[#c9a86a] to-[#A38245] px-6 py-2.5 font-[family-name:var(--font-inter)] text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#1a1206] shadow-[0_0_24px_rgba(189,153,82,0.25)] transition hover:brightness-110 disabled:opacity-40"
              >
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                Create Tenancy
              </button>
            }
          />
        </header>

        <section className="mb-10 grid grid-cols-2 gap-6 border-b border-[#484848]/10 py-10 md:grid-cols-4 md:gap-10">
          <div className="rounded-sm border border-[#484848]/15 bg-[#131313]/80 p-4 backdrop-blur-sm">
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA]">
              Total active
            </p>
            <p className="font-headline mt-2 text-2xl font-extralight tabular-nums text-[#BD9952]">
              {kpis.totalActive}
            </p>
            <p className="mt-1 font-[family-name:var(--font-inter)] text-[10px] text-[#767575]">
              +4% this month
            </p>
          </div>
          <div className="rounded-sm border border-[#484848]/15 bg-[#131313]/80 p-4 backdrop-blur-sm">
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA]">
              Collection rate
            </p>
            <p className="font-headline mt-2 text-2xl font-extralight tabular-nums text-[#E7E5E4]">
              {kpis.collectionRate.toFixed(1)}%
            </p>
            <p
              className={cn(
                "mt-1 font-[family-name:var(--font-inter)] text-[10px]",
                kpis.arrearsFlagged > 0 ? "text-[#ee7d77]" : "text-[#767575]",
              )}
            >
              {kpis.arrearsFlagged > 0
                ? `${kpis.arrearsFlagged} arrears flagged`
                : "All current"}
            </p>
          </div>
          <div className="rounded-sm border border-[#484848]/15 bg-[#131313]/80 p-4 backdrop-blur-sm">
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA]">
              Monthly revenue
            </p>
            <p className="font-headline mt-2 text-2xl font-extralight tabular-nums text-[#BD9952]">
              {gbp.format(kpis.monthlyRevenue)}
            </p>
            <p className="mt-1 font-[family-name:var(--font-inter)] text-[10px] text-[#767575]">
              Forecast: £{forecastK}k
            </p>
          </div>
          <div className="rounded-sm border border-[#484848]/15 bg-[#131313]/80 p-4 backdrop-blur-sm">
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA]">
              Onboarding
            </p>
            <p className="font-headline mt-2 text-2xl font-extralight tabular-nums text-[#E7E5E4]">
              {kpis.pendingOnboarding}
            </p>
            <p className="mt-1 font-[family-name:var(--font-inter)] text-[10px] text-[#767575]">
              {kpis.readySigning > 0 ? `${kpis.readySigning} ready for signing` : "Pipeline clear"}
            </p>
          </div>
        </section>

        <div className="overflow-hidden rounded-sm border border-[#484848]/15 bg-[#131313]/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#484848]/15 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.18em] text-[#767575]">
                  <th className="px-4 py-4 font-medium">Tenant</th>
                  <th className="px-4 py-4 font-medium">Property</th>
                  <th className="px-4 py-4 font-medium">Monthly rent</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="min-w-[140px] px-4 py-4 font-medium">Onboarding</th>
                  <th className="px-4 py-4 font-medium">Arrears</th>
                  <th className="px-4 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-16 text-center font-[family-name:var(--font-inter)] text-sm text-[#ACABAA]"
                    >
                      No tenancies yet. Create your first tenancy to populate this registry.
                    </td>
                  </tr>
                ) : (
                  slice.map((t) => {
                    const amount = t.monthlyRent ?? 0;
                    const { line1, line2 } = splitPropertyAddress(t.propertyAddress);
                    const { ui, arrears, payment } = paymentForTenancy(t.id, paymentByTenancy);
                    const ob = onboardingBar(t);
                    const barTone =
                      ob.tone === "green"
                        ? "bg-[#9cd4a8] shadow-[0_0_10px_rgba(156,212,168,0.35)]"
                        : ob.tone === "teal"
                          ? "bg-[#afefdd] shadow-[0_0_8px_rgba(175,239,221,0.25)]"
                          : "bg-[#BD9952] shadow-[0_0_8px_rgba(189,153,82,0.25)]";
                    const defaultPay =
                      payment && (payment.amountDue ?? 0) - (payment.amountPaid ?? 0) > 0
                        ? (payment.amountDue ?? 0) - (payment.amountPaid ?? 0)
                        : amount;
                    return (
                      <tr
                        key={t.id}
                        className="group border-b border-[#484848]/10 transition-colors hover:bg-[#1F2020]/50"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#484848]/30 bg-[#1F2020] font-[family-name:var(--font-inter)] text-xs font-semibold text-[#BD9952]"
                              aria-hidden
                            >
                              {initials(t.tenantFullName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[#E7E5E4]">
                                {t.tenantFullName ?? "—"}
                              </p>
                              <p className="font-mono text-[0.65rem] text-[#767575]">
                                {tenantRefId(t.id, t.tenantFullName)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[220px] px-4 py-4">
                          <p className="truncate text-sm text-[#C9C6C5]">{line1}</p>
                          {line2 ? (
                            <p className="truncate font-[family-name:var(--font-inter)] text-xs text-[#767575]">
                              {line2}
                            </p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-headline text-sm font-light tabular-nums text-[#E7E5E4]">
                          {gbp.format(amount)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge kind={ui} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2a2a2a]">
                              <div
                                className={cn("h-full rounded-full transition-all", barTone)}
                                style={{ width: `${ob.pct}%` }}
                              />
                            </div>
                            <span className="font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-wider text-[#ACABAA]">
                              {ob.label}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-headline text-sm tabular-nums">
                          {arrears != null && arrears > 0 ? (
                            <span className="text-[#ee7d77]">{gbp.format(arrears)}</span>
                          ) : (
                            <span className="text-[#484848]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2 opacity-100 md:opacity-60 md:transition-opacity md:group-hover:opacity-100">
                            <Link
                              href={`/dashboard/tenancies/${t.id}`}
                              className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#BD9952] hover:underline"
                            >
                              View
                            </Link>
                            {userId ? (
                              <>
                                <LogPaymentDialog
                                  tenancyId={t.id}
                                  rentPaymentId={payment?.id}
                                  defaultAmountPaid={defaultPay}
                                  triggerLabel="Pay"
                                  triggerClassName="border-[#484848]/40 bg-transparent text-[10px] uppercase tracking-widest text-[#C9C6C5] hover:border-[#BD9952]/50 hover:text-[#BD9952]"
                                />
                                <EditTenancyDialog
                                  tenancyId={t.id}
                                  userId={userId}
                                  initial={{
                                    startDate: t.startDate,
                                    endDate: t.endDate,
                                    moveInDate: t.moveInDate,
                                    monthlyRent: t.monthlyRent,
                                    depositAmount: t.depositAmount,
                                    status: t.status,
                                  }}
                                  triggerLabel="Edit"
                                  triggerClassName="border-[#484848]/40 bg-transparent text-[10px] uppercase tracking-widest text-[#C9C6C5] hover:border-[#BD9952]/50 hover:text-[#BD9952]"
                                />
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-[#484848]/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#767575]">
              Displaying {displayFrom} — {displayTo} of {total} tenancies
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-sm border border-[#484848]/30 p-1.5 text-[#ACABAA] transition hover:border-[#BD9952]/40 hover:text-[#BD9952] disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={cn(
                      "min-w-9 px-2 py-1 font-[family-name:var(--font-inter)] text-xs tabular-nums transition",
                      n === safePage
                        ? "border-b-2 border-[#BD9952] text-[#BD9952]"
                        : "text-[#767575] hover:text-[#C9C6C5]",
                    )}
                  >
                    {String(n).padStart(2, "0")}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="rounded-sm border border-[#484848]/30 p-1.5 text-[#ACABAA] transition hover:border-[#BD9952]/40 hover:text-[#BD9952] disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Link
        href="/dashboard"
        className="fixed bottom-8 right-8 z-30 flex size-12 items-center justify-center rounded-sm border border-[#BD9952]/30 bg-[#131313] text-[#BD9952] shadow-[0_0_20px_rgba(189,153,82,0.2)] transition hover:border-[#BD9952]/60 hover:shadow-[0_0_28px_rgba(189,153,82,0.35)]"
        aria-label="Open intelligence assistant"
      >
        <Sparkles className="size-5" strokeWidth={1.5} />
      </Link>
    </div>
  );
}
