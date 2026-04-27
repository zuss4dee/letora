"use client";

import { ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  deleteRentPayment,
  markRentOverdue,
  markRentPaid,
  type RentPaymentListRow,
} from "@/lib/actions/rent-tracker";
import type { RentTrackerSummaryStats } from "@/lib/rent-tracker-stats";
import type { TenancyRow } from "@/lib/actions/tenancies";
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
      <span className="bg-[#93000a] text-white px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
        OVERDUE
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="bg-[#464747] text-[#b5b5b5] px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
        PARTIAL
      </span>
    );
  }
  if (status === "due_soon") {
    return (
      <span className="bg-[#161616] border border-[#282828] text-[#888888] px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
        DUE SOON
      </span>
    );
  }
  if (status === "paid") {
    return (
      <span className="bg-[#152420] border border-[#21473c] text-[#9ad7c3] px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
        PAID
      </span>
    );
  }
  return (
    <span className="bg-[#161616] border border-[#282828] text-[#888888] px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
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
  const [selectedId, setSelectedId] = useState<string | null>(payments[0]?.id ?? null);
  const [query, setQuery] = useState("");

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) => {
      const hay = [p.tenantName, p.propertyAddress].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [payments, query]);

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

  const overdueTotal = stats.arrearsAmount;
  const dueSoonTotal = stats.forecastNext30Days;
  const pendingApprovalsCount = 0; // Mocked for now

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row bg-[#0B0B0B] w-full font-[family-name:var(--font-inter)] text-[#e5e2e1] overflow-hidden antialiased">
      {/* LEFT WORKSPACE: SUMMARY + TABLE */}
      <section className="flex-1 flex flex-col min-h-0 border-r border-[#282828]">
        {/* TOP BAR: Search & Report */}
        <div className="flex items-center justify-between border-b border-[#282828] bg-[#161616] p-2 sm:px-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#888888] size-3.5" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH TENANTS, PROPERTIES, OR ARREARS..."
              className="bg-[#0B0B0B] border border-[#333333] text-[10px] w-full pl-8 py-1.5 focus:border-white focus:outline-none placeholder-[#444748] uppercase transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => downloadReportCsv(filtered, todayIso)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-wider font-bold text-[#888888] hover:text-white border border-transparent hover:border-[#333333] transition-colors bg-[#1A1A1A]"
          >
            <Download className="size-3.5" />
            Report
          </button>
        </div>

        {/* COMPACT SUMMARY ROW */}
        <div className="flex border-b border-[#282828] bg-[#161616] shrink-0 divide-x divide-[#282828]">
          <div className="flex-1 p-3 sm:px-4">
            <div className="text-[10px] text-[#888888] uppercase tracking-tighter mb-1 font-medium">Overdue Total</div>
            <div className="text-lg font-mono font-semibold text-white tracking-tight">{gbp.format(overdueTotal)}</div>
            <div className="text-[9px] text-[#ee8a85] flex items-center gap-1 mt-0.5 font-medium">
              <span className="material-symbols-outlined text-[10px] leading-none">trending_up</span>
              +4.2% VS LW
            </div>
          </div>
          <div className="flex-1 p-3 sm:px-4">
            <div className="text-[10px] text-[#888888] uppercase tracking-tighter mb-1 font-medium">Due Soon</div>
            <div className="text-lg font-mono font-semibold text-white tracking-tight">{gbp.format(dueSoonTotal)}</div>
            <div className="text-[9px] text-[#888888] mt-0.5 font-medium uppercase tracking-wider">Next 30 Days</div>
          </div>
          <div className="flex-1 p-3 sm:px-4 hidden sm:block">
            <div className="text-[10px] text-[#888888] uppercase tracking-tighter mb-1 font-medium">Pending Approvals</div>
            <div className="text-lg font-mono font-semibold text-white tracking-tight">{pendingApprovalsCount}</div>
            <div className="text-[9px] text-[#e2e2e2] mt-0.5 font-medium uppercase tracking-wider">
              {pendingApprovalsCount > 0 ? "ACTION REQUIRED" : "ALL CLEAR"}
            </div>
          </div>
        </div>

        {/* TABLE OPERATIONS */}
        <div className="flex-1 overflow-auto bg-[#1A1A1A]">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="sticky top-0 bg-[#161616] z-10 border-b border-[#282828]">
              <tr className="text-[10px] text-[#888888] uppercase tracking-wider font-medium">
                <th className="px-4 py-2.5 font-medium">Tenant</th>
                <th className="px-4 py-2.5 font-medium">Property</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount Due</th>
                <th className="px-4 py-2.5 font-medium">Due Date</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-center">Days</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="text-[12px] text-[#c4c7c8]">
              {filtered.map((p) => {
                const isSelected = selectedId === p.id;
                const status = getDisplayStatus(p, todayIso);
                const daysLate = calculateDaysLate(p.due_date, todayIso);

                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "border-b border-[#282828] cursor-pointer transition-colors",
                      isSelected ? "bg-[#242424]" : "hover:bg-[#202020]",
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-white">{p.tenantName || "—"}</td>
                    <td className="px-4 py-2.5 text-[#888888] max-w-[200px] truncate" title={p.propertyAddress || ""}>
                      {p.propertyAddress || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11px]">{gbp.format(p.amount)}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px]">{formatDisplayDate(p.due_date)}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={status} />
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-[11px]">
                      {status === "overdue" && daysLate ? (
                        <span className="text-[#ee8a85] font-semibold">{daysLate}</span>
                      ) : (
                        <span className="text-[#888888]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ChevronRight
                        className={cn("inline-block size-4", isSelected ? "text-white" : "text-[#333333]")}
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[11px] text-[#888888]">
                    No payments match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* RIGHT DETAIL PANEL */}
      {selectedRow && (
        <section className="w-full lg:w-[360px] flex flex-col bg-[#161616] shrink-0 overflow-y-auto">
          {/* PANEL HEADER */}
            <div className="p-4 border-b border-[#282828] shrink-0">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-[10px] text-[#888888] uppercase tracking-widest font-semibold mb-1">
                    Selected Tenant
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight leading-none">
                    {selectedRow.tenantName || "Unknown Tenant"}
                  </h2>
                  <div className="text-[11px] text-[#888888] font-mono mt-1">
                    TEN-ID: {selectedRow.tenancyId?.slice(0, 8).toUpperCase() || "N/A"}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-[#888888] hover:text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="bg-[#0B0B0B] border border-[#282828] p-3 mb-4">
                <div className="text-[10px] text-[#888888] uppercase tracking-tighter mb-1 font-medium">
                  Current Amount Due
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold text-white tracking-tight">
                    {gbp.format(selectedRow.amount)}
                  </span>
                  {getDisplayStatus(selectedRow, todayIso) === "overdue" && (
                    <span className="text-[#ee8a85] text-[11px] font-medium font-mono tracking-wider">
                      {calculateDaysLate(selectedRow.due_date, todayIso)} DAYS LATE
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#888888]">Chase Status:</span>
                  <span className="text-white font-medium">—</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#888888]">Last Action:</span>
                  <span className="text-white font-medium">—</span>
                </div>
              </div>
            </div>

            {/* RELATED APPROVALS */}
            <div className="p-4 border-b border-[#282828] shrink-0">
              <div className="text-[10px] text-[#888888] uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">fact_check</span>
                Related Approvals
              </div>
              <div className="text-[11px] text-[#888888] italic px-2">No pending approvals.</div>
            </div>

            {/* PAYMENT HISTORY */}
            <div className="p-4 border-b border-[#282828] flex-1 min-h-0 overflow-y-auto">
              <div className="text-[10px] text-[#888888] uppercase tracking-widest font-bold mb-3">
                Payment History
              </div>
              <div className="space-y-3">
                {historyRows.length === 0 ? (
                  <div className="text-[11px] text-[#888888] italic px-2">No payment history available.</div>
                ) : (
                  historyRows.map((hr) => {
                    const dStatus = getDisplayStatus(hr, todayIso);
                    const isPaid = hr.status === "paid";
                    const wasLate = hr.paid_date && hr.due_date && hr.paid_date > hr.due_date;

                    return (
                      <div
                        key={hr.id}
                        className="flex justify-between items-center border-l border-[#282828] pl-3 py-1"
                      >
                        <div>
                          <div className="text-[11px] font-semibold text-white font-mono">
                            {gbp.format(hr.amount)}
                          </div>
                          <div className="text-[9px] text-[#888888] font-mono uppercase tracking-wider">
                            {hr.due_date
                              ? new Date(hr.due_date).toLocaleDateString("en-GB", {
                                  month: "short",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </div>
                        </div>
                        {isPaid ? (
                          <span
                            className={cn(
                              "text-[9px] font-bold tracking-wider",
                              wasLate ? "text-yellow-500" : "text-green-500",
                            )}
                          >
                            PAID {wasLate ? "(LATE)" : "(ON TIME)"}
                          </span>
                        ) : (
                          <span className="text-[9px] text-[#888888] font-bold uppercase tracking-wider">
                            {dStatus}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="p-4 bg-[#1A1A1A] grid grid-cols-2 gap-2 shrink-0">
              <button
                onClick={() => {
                  if (selectedRow.tenantId) {
                    router.push(`/dashboard/tenants/${selectedRow.tenantId}`);
                  } else {
                    toast.error("Tenant profile not found for this record.");
                  }
                }}
                className="border border-[#333333] bg-[#0B0B0B] text-white py-1.5 font-bold text-[9px] tracking-wider uppercase hover:bg-[#242424] transition-colors"
              >
                Open Tenant
              </button>
              <button
                onClick={() => {
                  if (selectedRow.tenancyId) {
                    router.push(`/dashboard/tenancies/${selectedRow.tenancyId}`);
                  } else {
                    toast.error("Tenancy record not found for this record.");
                  }
                }}
                className="border border-[#333333] bg-[#0B0B0B] text-white py-1.5 font-bold text-[9px] tracking-wider uppercase hover:bg-[#242424] transition-colors"
              >
                Open Tenancy
              </button>
              <button
                onClick={() => toast.info("Please use the Assistant Chat to draft a rent chase email.")}
                className="border border-[#333333] bg-[#0B0B0B] text-white py-1.5 font-bold text-[9px] tracking-wider uppercase hover:bg-[#242424] transition-colors"
              >
                Draft Chase
              </button>
              <button
                onClick={() => router.push("/dashboard/approvals")}
                className="border border-[#333333] bg-[#0B0B0B] text-white py-1.5 font-bold text-[9px] tracking-wider uppercase hover:bg-[#242424] transition-colors"
              >
                Approvals
              </button>
              <div className="col-span-2">
                {selectedRow.status !== "paid" ? (
                  <button
                    disabled={busyId === selectedRow.id}
                    onClick={() => void run(selectedRow.id, () => markRentPaid(selectedRow.id, todayIso))}
                    className="w-full border border-[#333333] bg-[#152420] text-[#9ad7c3] py-2 font-bold text-[10px] tracking-wider uppercase hover:bg-[#1a3028] transition-colors disabled:opacity-50"
                  >
                    Mark Paid
                  </button>
                ) : (
                  <button
                    disabled={busyId === selectedRow.id}
                    onClick={() => void run(selectedRow.id, () => deleteRentPayment(selectedRow.id))}
                    className="w-full border border-[#333333] bg-[#271716] text-[#ee8a85] py-2 font-bold text-[10px] tracking-wider uppercase hover:bg-[#382120] transition-colors disabled:opacity-50"
                  >
                    Delete Record
                  </button>
                )}
              </div>
            </div>
        </section>
      )}
    </div>
  );
}
