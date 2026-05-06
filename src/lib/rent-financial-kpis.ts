import { isoDateBetweenInclusive, monthBoundsIso } from "@/lib/rent-calendar-bounds";
import { resolvePaymentAmount } from "@/lib/rent-payment-helpers";

/** Row shape for Command Center rent KPI maths (subset of DB / list rows). */
export type RentFinanceKpiRowInput = {
  id: string;
  amount?: unknown;
  /** Ignored unless `amount` is missing — aligns with legacy `resolvePaymentAmount`. */
  amount_due?: unknown;
  status: string | null;
  due_date: string | null;
  paid_date: string | null;
};

export type RentFinancialMonthKpis = {
  rentDueThisMonth: number;
  rentScheduledThisMonth: number;
  rentCollectedThisMonth: number;
  rentExpectedNextMonth: number;
  rentCollectedLastMonth: number;
};

function isPaidRentStatus(status: string | null): boolean {
  return (status ?? "").toLowerCase() === "paid";
}

/**
 * Pure Command Center financial strip (matches `loadCommandCenterFinancials` aggregation after rows are merged).
 * Anchor is the UTC calendar day string used everywhere else (`YYYY-MM-DD`).
 */
export function computeRentFinancialMonthKpis(
  rows: Iterable<RentFinanceKpiRowInput>,
  anchorIsoDate: string,
): RentFinancialMonthKpis {
  const anchor = anchorIsoDate.slice(0, 10);
  const current = monthBoundsIso(anchor, 0);
  const nextMonth = monthBoundsIso(anchor, 1);
  const lastMonth = monthBoundsIso(anchor, -1);

  const stats: RentFinancialMonthKpis = {
    rentDueThisMonth: 0,
    rentScheduledThisMonth: 0,
    rentCollectedThisMonth: 0,
    rentExpectedNextMonth: 0,
    rentCollectedLastMonth: 0,
  };

  for (const p of rows) {
    const amt = resolvePaymentAmount(p);
    const due = (p.due_date ?? "").slice(0, 10);
    const paidIso = (p.paid_date ?? "").slice(0, 10);

    if (due && isoDateBetweenInclusive(due, current.startIso, current.endIso)) {
      stats.rentScheduledThisMonth += amt;
    }

    if (due && isoDateBetweenInclusive(due, current.startIso, current.endIso) && !isPaidRentStatus(p.status)) {
      stats.rentDueThisMonth += amt;
    }

    if (due && isoDateBetweenInclusive(due, nextMonth.startIso, nextMonth.endIso)) {
      stats.rentExpectedNextMonth += amt;
    }

    if (isPaidRentStatus(p.status)) {
      if (paidIso && isoDateBetweenInclusive(paidIso, current.startIso, current.endIso)) {
        stats.rentCollectedThisMonth += amt;
      } else if (!paidIso && due && isoDateBetweenInclusive(due, current.startIso, current.endIso)) {
        stats.rentCollectedThisMonth += amt;
      }

      if (paidIso && isoDateBetweenInclusive(paidIso, lastMonth.startIso, lastMonth.endIso)) {
        stats.rentCollectedLastMonth += amt;
      } else if (!paidIso && due && isoDateBetweenInclusive(due, lastMonth.startIso, lastMonth.endIso)) {
        stats.rentCollectedLastMonth += amt;
      }
    }
  }

  return stats;
}
