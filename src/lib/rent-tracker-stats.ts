import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";

export type RentTrackerSummaryStats = {
  expectedThisMonth: number;
  receivedThisMonth: number;
  overdueCount: number;
};

function monthStartEndLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const startIso = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const endIso = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  return { startIso, endIso };
}

export function computeRentTrackerStats(
  payments: RentPaymentListRow[],
  todayIso: string,
): RentTrackerSummaryStats {
  const { startIso, endIso } = monthStartEndLocal();

  let expectedThisMonth = 0;
  let receivedThisMonth = 0;
  let overdueCount = 0;

  for (const p of payments) {
    const due = p.due_date;
    if (due && due >= startIso && due <= endIso) {
      expectedThisMonth += p.amount;
    }

    const paid = p.paid_date;
    const st = (p.status ?? "").toLowerCase();
    if (st === "paid" && paid && paid >= startIso && paid <= endIso) {
      receivedThisMonth += p.amount;
    }

    if (st === "overdue" || (st === "pending" && due && due < todayIso)) {
      overdueCount += 1;
    }
  }

  return { expectedThisMonth, receivedThisMonth, overdueCount };
}
