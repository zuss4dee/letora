import { isPaymentOverdue, resolvePaymentAmount } from "@/lib/rent-payment-helpers";
import { addCalendarDaysIso, isoDateBetweenInclusive, monthBoundsIso } from "@/lib/rent-calendar-bounds";
import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";

export type RentTenancyRentRollRow = {
  monthlyRent: number | null;
  status: string | null;
};

export type RentTrackerSummaryStats = {
  /**
   * Contractual expectation: sum of `monthly_rent` for **active** tenancies in scope.
   * Fallback (when roll is zero): sum of instalment amounts with `due_date` in the current month.
   */
  expectedThisMonth: number;
  /** Cash recognised this calendar month (`paid_date` in month when present; legacy: paid + no date → attributed by due month). */
  receivedThisMonth: number;
  /** Still unpaid instalments with `due_date` in the current calendar month (not arrears-only). */
  outstandingThisMonth: number;
  overdueCount: number;
  /** Sum of amounts for overdue rows (past-due, unpaid per `isPaymentOverdue`). */
  arrearsAmount: number;
  /**
   * Unpaid instalments with due_date in (today, today+30d] — actionable upcoming pipeline only.
   * No synthetic multiplier fallback.
   */
  nextUnpaidPipeline30d: number;
};

function isPaidRentStatus(status: string | null): boolean {
  return (status ?? "").toLowerCase() === "paid";
}

function sumActiveMonthlyRentRoll(tenancies: RentTenancyRentRollRow[]): number {
  let sum = 0;
  for (const t of tenancies) {
    if ((t.status ?? "").toLowerCase() !== "active") continue;
    const r = t.monthlyRent;
    if (r == null || !Number.isFinite(r)) continue;
    sum += r;
  }
  return sum;
}

/** Dev-only diagnostics for KPI wiring verification. */
function logRentTrackerStats(snapshot: RentTrackerSummaryStats & { todayIso: string; mode: string }) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[rent-tracker-stats]", snapshot);
}

export function computeRentTrackerStats(
  payments: RentPaymentListRow[],
  todayIso: string,
  tenanciesInScope: RentTenancyRentRollRow[],
): RentTrackerSummaryStats {
  const anchor = todayIso.slice(0, 10);
  const { startIso: curStart, endIso: curEnd } = monthBoundsIso(anchor, 0);

  const rentRollExpected = sumActiveMonthlyRentRoll(tenanciesInScope);
  let scheduledDueThisMonth = 0;

  let receivedThisMonth = 0;
  let outstandingThisMonth = 0;
  let overdueCount = 0;
  let arrearsAmount = 0;
  let nextUnpaidPipeline30d = 0;

  const horizonEndExclusive = addCalendarDaysIso(anchor, 30);

  for (const p of payments) {
    const amount = resolvePaymentAmount(p);
    const due = p.due_date;

    const dueThisMonth = due != null && isoDateBetweenInclusive(due, curStart, curEnd);
    if (dueThisMonth) {
      scheduledDueThisMonth += amount;
      if (!isPaidRentStatus(p.status)) outstandingThisMonth += amount;
    }

    if (isPaidRentStatus(p.status)) {
      const paidIso = (p.paid_date ?? "").slice(0, 10);
      if (paidIso && isoDateBetweenInclusive(paidIso, curStart, curEnd)) {
        receivedThisMonth += amount;
      } else if (!paidIso && dueThisMonth) {
        /** Legacy/backfill: counted as receipt in instalment due month only. */
        receivedThisMonth += amount;
      }
    }

    if (isPaymentOverdue(p.status, p.due_date, anchor)) {
      overdueCount += 1;
      arrearsAmount += amount;
    }

    if (
      due != null &&
      due.length >= 10 &&
      due.slice(0, 10) > anchor &&
      due.slice(0, 10) <= horizonEndExclusive &&
      !isPaidRentStatus(p.status)
    ) {
      nextUnpaidPipeline30d += amount;
    }
  }

  const expectedThisMonth = rentRollExpected > 0 ? rentRollExpected : scheduledDueThisMonth;

  const result: RentTrackerSummaryStats = {
    expectedThisMonth,
    receivedThisMonth,
    outstandingThisMonth,
    overdueCount,
    arrearsAmount,
    nextUnpaidPipeline30d,
  };

  logRentTrackerStats({
    todayIso: anchor,
    mode: rentRollExpected > 0 ? "expected=active_rent_roll" : "expected=scheduled_instalments_fallback",
    ...result,
  });

  return result;
}
