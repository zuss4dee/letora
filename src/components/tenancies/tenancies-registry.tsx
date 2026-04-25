"use client";

import { CheckCircle2, Circle, Ellipsis, Hourglass, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AddTenancyDialog } from "@/components/rent/add-tenancy-dialog";
import { LogPaymentDialog } from "@/components/rent/log-payment-dialog";
import { EditTenancyDialog } from "@/components/tenancies/edit-tenancy-dialog";
import type { RentPaymentRow, TenancyRow } from "@/lib/actions/tenancies";
import { cn } from "@/lib/utils";

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
}: {
  tenancies: TenancyRow[];
  paymentsThisMonth: RentPaymentRow[];
  userId: string | null;
  propertyOptions: Array<{ id: string; label: string }>;
  tenantOptions: Array<{ id: string; label: string }>;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "onboarding" | "overdue">("all");
  const [selectedTenancyId, setSelectedTenancyId] = useState<string | null>(tenancies[0]?.id ?? null);

  const paymentByTenancy = useMemo(() => {
    const map = new Map<string, RentPaymentRow>();
    for (const payment of paymentsThisMonth) {
      const tenancyId = payment.tenancyId;
      if (!tenancyId || map.has(tenancyId)) continue;
      map.set(tenancyId, payment);
    }
    return map;
  }, [paymentsThisMonth]);

  const sortedRows = useMemo(
    () => [...tenancies].sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "")),
    [tenancies],
  );

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
    return (
      filteredRows.find((row) => row.id === selectedTenancyId) ??
      filteredRows[0] ??
      null
    );
  }, [filteredRows, selectedTenancyId]);

  const selectedPayment = selected ? paymentForTenancy(selected.id, paymentByTenancy) : null;
  const selectedAddress = splitAddress(selected?.propertyAddress ?? null);
  const selectedOnboarding = onboardingProgress(selected?.onboardingStatus ?? null);
  const selectedMoveInDate = selected?.moveInDate ?? selected?.startDate ?? null;

  return (
    <div className="flex min-h-0 flex-1 bg-[#0e0e0e] text-[#e5e2e1]">
      <div className="flex min-w-0 flex-1 flex-col border-r border-[#232323]">
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
            <button type="button" className="hover:text-[#c4c7c8]">
              Sort by: Date Added
            </button>
            <button type="button" className="hover:text-[#c4c7c8]">
              Columns
            </button>
            <AddTenancyDialog
              properties={propertyOptions}
              tenants={tenantOptions}
              trigger={
                <button
                  type="button"
                  disabled={propertyOptions.length === 0 || tenantOptions.length === 0}
                  className="inline-flex h-7 items-center gap-1 border border-[#343434] bg-[#f5f5f5] px-2 text-[11px] font-semibold text-[#101010] disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  Quick Action
                </button>
              }
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
                <th className="px-3 py-2 font-medium">Move-in Stage</th>
                <th className="px-3 py-2 font-medium">Referencing</th>
              </tr>
            </thead>
            <tbody className="text-[12px]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-[12px] text-[#7b7b7b]">
                    No tenancies found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const address = splitAddress(row.propertyAddress);
                  const payment = paymentForTenancy(row.id, paymentByTenancy);
                  const onboarding = onboardingProgress(row.onboardingStatus);
                  const rowStatus = statusLabel(row.status);
                  const isSelected = selected?.id === row.id;
                  const paymentDue =
                    payment.payment?.amountDue ??
                    payment.payment?.amountPaid ??
                    row.monthlyRent ??
                    0;
                  const payDefault =
                    payment.payment && (payment.payment.amountDue ?? 0) - (payment.payment.amountPaid ?? 0) > 0
                      ? (payment.payment.amountDue ?? 0) - (payment.payment.amountPaid ?? 0)
                      : paymentDue;
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
                      <td className="px-3 py-2.5">
                        {onboarding.pct === 100 ? (
                          <span className="text-[11px] text-[#7f7f7f]">{fmtShortDate(selectedMoveInDate)}</span>
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
                      <td className="px-3 py-2.5">
                        {onboarding.pct >= 52 ? (
                          <CheckCircle2 className="size-3.5 text-[#35bb61]" />
                        ) : onboarding.pct >= 20 ? (
                          <Hourglass className="size-3.5 text-[#a3a3a3]" />
                        ) : (
                          <Circle className="size-3.5 text-[#5f5f5f]" />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="hidden w-[320px] shrink-0 flex-col border-l border-[#232323] bg-[#111111] lg:flex">
        {selected ? (
          <>
            <div className="border-b border-[#232323] p-5">
              <p className="mb-4 text-[10px] uppercase tracking-[0.14em] text-[#6f6f6f]">Inspector</p>
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
                    <p className="text-[10px] text-[#6f6f6f]">Referencing</p>
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-[#35bb61]">
                      <CheckCircle2 className="size-3.5" />
                      {selectedOnboarding.pct >= 52 ? "PASSED" : "PENDING"}
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
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f6f6f]">
                    Onboarding Flow
                  </h3>
                  <span className="text-[10px] font-medium text-[#e5e5e5]">
                    {selectedOnboarding.pct >= 100 ? "6/6 TASKS" : "4/6 TASKS"}
                  </span>
                </div>
                <div className="space-y-2 text-[11px]">
                  {[
                    { done: selectedOnboarding.pct >= 20, label: "Identity Verified" },
                    { done: selectedOnboarding.pct >= 52, label: "References Cleared" },
                    { done: selectedOnboarding.pct >= 78, label: "Agreement Signed" },
                    { done: selectedOnboarding.pct >= 100, label: "First Rent Paid" },
                  ].map((task) => (
                    <div key={task.label} className="flex items-center gap-2">
                      {task.done ? (
                        <CheckCircle2 className="size-3.5 text-[#35bb61]" />
                      ) : (
                        <Circle className="size-3.5 text-[#5f5f5f]" />
                      )}
                      <span className={task.done ? "text-[#d4d4d4]" : "text-[#777777]"}>{task.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-[#282828] bg-[#171717] p-4">
                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f6f6f]">
                  Rent Ledger
                </h3>
                <div className="mb-4 flex items-end justify-between">
                  <span className="text-[11px] text-[#919191]">Current Balance</span>
                  <span className="font-mono text-[28px] font-semibold text-[#f0f0f0]">
                    {gbp.format(selectedPayment?.arrears ?? 0)}
                  </span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <Link
                    href={`/dashboard/tenancies/${selected.id}`}
                    className="flex items-center justify-between px-1 py-1.5 text-[#9c9c9c] hover:bg-[#212121] hover:text-[#d7d7d7]"
                  >
                    <span>View Full Ledger</span>
                    <span>›</span>
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-1 py-1.5 text-left text-[#9c9c9c] hover:bg-[#212121] hover:text-[#d7d7d7]"
                  >
                    <span>Upcoming Approvals</span>
                    <span className="rounded-full bg-[#1f3961] px-1.5 text-[9px] text-[#86b5ff]">
                      {selectedOnboarding.pct < 100 ? "2" : "0"}
                    </span>
                  </button>
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f6f6f]">
                  Activity Log
                </h3>
                <div className="relative ml-1 border-l border-[#2b2b2b] pl-4">
                  {[
                    { state: "neutral", title: "Agreement Generated", detail: "2 hours ago • By System" },
                    { state: "good", title: "References Approved", detail: "Yesterday • By Letora" },
                    { state: "neutral", title: "Application Received", detail: "3 days ago • By Portal" },
                  ].map((entry) => (
                    <div key={entry.title} className="relative mb-5">
                      <span
                        className={cn(
                          "absolute -left-[21px] top-1 size-2.5 rounded-full border border-[#3a3a3a] bg-[#1a1a1a]",
                          entry.state === "good" && "border-[#35bb61] bg-[#35bb61]",
                        )}
                      />
                      <p className="text-[11px] font-medium text-[#efefef]">{entry.title}</p>
                      <p className="text-[10px] text-[#727272]">{entry.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="border-t border-[#232323] bg-[#111111] p-4">
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
                  href="/dashboard/properties"
                  className="block w-full border border-[#313131] py-2 text-center text-[10px] text-[#a8a8a8] hover:border-[#454545] hover:text-[#d4d4d4]"
                >
                  View Property
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="p-5 text-[12px] text-[#808080]">Select a tenancy to inspect.</div>
        )}
      </aside>
    </div>
  );
}
