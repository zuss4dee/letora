import { isPaymentOverdue, resolvePaymentAmount } from "@/lib/rent-utils";
import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";

export type RentTrackerSummaryStats = {
  expectedThisMonth: number;
  receivedThisMonth: number;
  overdueCount: number;
  /** Sum of amounts for payments counted in overdueCount */
  arrearsAmount: number;
  /** Sum of amounts with due dates in the next 30 days (pipeline); falls back when empty */
  forecastNext30Days: number;
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

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function computeRentTrackerStats(
  payments: RentPaymentListRow[],
  todayIso: string,
): RentTrackerSummaryStats {
  const { startIso, endIso } = monthStartEndLocal();

  let expectedThisMonth = 0;
  let receivedThisMonth = 0;
  let overdueCount = 0;
  let arrearsAmount = 0;
  let forecastNext30Days = 0;

  const horizonEnd = addDaysIso(todayIso, 30);

  for (const p of payments) {
    const amount = resolvePaymentAmount(p);
    const due = p.due_date;
    if (due && due >= startIso && due <= endIso) {
      expectedThisMonth += amount;
    }

    const paid = p.paid_date;
    const st = (p.status ?? "").toLowerCase();
    if (st === "paid" && paid && paid >= startIso && paid <= endIso) {
      receivedThisMonth += amount;
    }

    if (isPaymentOverdue(p.status, p.due_date, todayIso)) {
      overdueCount += 1;
      arrearsAmount += amount;
    }

    if (due && due > todayIso && due <= horizonEnd) {
      forecastNext30Days += amount;
    }
  }

  if (forecastNext30Days === 0 && expectedThisMonth > 0) {
    forecastNext30Days = Math.round(expectedThisMonth * 1.02);
  }

  return {
    expectedThisMonth,
    receivedThisMonth,
    overdueCount,
    arrearsAmount,
    forecastNext30Days,
  };
}
