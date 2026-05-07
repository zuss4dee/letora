/**
 * Semantics map — where rent month / receipt rules live:
 *
 * | Concern | Command Center (dashboard KPI strip) | Rent Tracker (registry summary) |
 * |---------|--------------------------------------|----------------------------------|
 * | Scheduled in current month (`due_date` ∈ month), after **active rent roll** overlay when roll &gt; 0 | `computeRentFinancialMonthKpis` → `rentScheduledThisMonth`; pass `activeMonthlyRentRoll` from `getMonthlyRentFromActiveTenancies` | Matches `computeRentTrackerStats`: if active rent roll sum &gt; 0, **expected** shows roll; else instalment sum in month. |
 * | Unpaid in current month (`due_date` ∈ month, status not paid) | `rentDueThisMonth` | `outstandingThisMonth` — **same arithmetic** when both use `resolvePaymentAmount` / same status rules. |
 * | Cash this month | `rentCollectedThisMonth`: paid + `paid_date` in month OR paid + no `paid_date` + due in month | `receivedThisMonth` — **matching branches** in `computeRentTrackerStats`. |
 * | Cash last month | `rentCollectedLastMonth` (same legacy rule on **last** window) | *(not surfaced on tracker summary — Command Center only).* |
 * | Next calendar month contract | `rentExpectedNextMonth`: all instalments due in **next calendar month** (any status) | **`nextUnpaidPipeline30d` is different**: unpaid only, `due_date` ∈ (today, today+30d] string window — sliding horizon, not “next month bucket”. Tests assert both deliberately. |
 * | Cross-month arrears | **Not** in financial strip — arrears GBP on dashboard uses `getDashboardStats` (`isPaymentOverdue`) | `arrearsAmount` + `overdueCount` count every overdue instalment regardless of calendar month of `due_date`. |
 */

import { describe, expect, it } from "vitest";

import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";
import {
  computeRentFinancialMonthKpis,
  type RentFinanceKpiRowInput,
} from "@/lib/rent-financial-kpis";
import { computeRentTrackerStats, type RentTenancyRentRollRow } from "@/lib/rent-tracker-stats";

const NO_RENT_ROLL: RentTenancyRentRollRow[] = [];

/** Active roll fixture: instalment schedule no longer drives `expectedThisMonth`. */
const RENT_ROLL_1200: RentTenancyRentRollRow[] = [{ monthlyRent: 1200, status: "active" }];

function pay(overrides: Partial<RentPaymentListRow>): RentPaymentListRow {
  return {
    id: "p1",
    amount: 1000,
    due_date: "2026-05-01",
    paid_date: null,
    status: "pending",
    notes: null,
    tenancyId: "t1",
    propertyAddress: null,
    tenantName: null,
    tenantId: null,
    ...overrides,
  };
}

function toFinanceInputs(payments: RentPaymentListRow[]): RentFinanceKpiRowInput[] {
  return payments.map((p) => ({
    id: p.id,
    amount: p.amount,
    status: p.status,
    due_date: p.due_date,
    paid_date: p.paid_date,
  }));
}

/** Stripe / Command Center overlays: pass active rent roll so “scheduled” matches Rent Tracker Expected (Mo). */
function expectOverlappingStripeMatches(
  payments: RentPaymentListRow[],
  anchor: string,
  tenancies: RentTenancyRentRollRow[],
) {
  const roll = tenancies.reduce((s, t) => {
    if ((t.status ?? "").toLowerCase() !== "active") return s;
    const r = t.monthlyRent;
    return s + (r != null && Number.isFinite(r) ? r : 0);
  }, 0);
  const cc = computeRentFinancialMonthKpis(toFinanceInputs(payments), anchor, {
    activeMonthlyRentRoll: roll > 0 ? roll : undefined,
  });
  const tr = computeRentTrackerStats(payments, anchor, tenancies);
  expect(tr.receivedThisMonth).toBe(cc.rentCollectedThisMonth);
  expect(tr.outstandingThisMonth).toBe(cc.rentDueThisMonth);
  expect(tr.expectedThisMonth).toBe(cc.rentScheduledThisMonth);
}

describe("rent attribution semantics (Command Center monthly strip vs Rent Tracker)", () => {
  it("case 1: due this calendar month and paid this calendar month — scheduled, collected, not outstanding", () => {
    const payments = [
      pay({
        id: "a",
        amount: 950,
        due_date: "2026-05-05",
        paid_date: "2026-05-06",
        status: "paid",
      }),
    ];
    expectOverlappingStripeMatches(payments, "2026-05-15", NO_RENT_ROLL);
    const cc = computeRentFinancialMonthKpis(toFinanceInputs(payments), "2026-05-15");
    expect(cc).toMatchObject({
      rentScheduledThisMonth: 950,
      rentDueThisMonth: 0,
      rentCollectedThisMonth: 950,
      rentExpectedNextMonth: 0,
    });
  });

  it("case 2: due last calendar month but paid this month — counts as collected this month, not scheduled this month", () => {
    const payments = [
      pay({
        id: "b",
        amount: 800,
        due_date: "2026-04-10",
        paid_date: "2026-05-02",
        status: "paid",
      }),
    ];
    expectOverlappingStripeMatches(payments, "2026-05-18", NO_RENT_ROLL);
    const cc = computeRentFinancialMonthKpis(toFinanceInputs(payments), "2026-05-18");
    expect(cc.rentScheduledThisMonth).toBe(0);
    expect(cc.rentCollectedThisMonth).toBe(800);
    expect(cc.rentDueThisMonth).toBe(0);
  });

  it("case 3: due this month, unpaid — outstanding + scheduled; overdue when anchor strictly after due", () => {
    const payments = [pay({ id: "c", due_date: "2026-05-01", status: "pending" })];
    expectOverlappingStripeMatches(payments, "2026-05-15", NO_RENT_ROLL);
    const tr = computeRentTrackerStats(payments, "2026-05-15", NO_RENT_ROLL);
    expect(tr.overdueCount).toBe(1);
    expect(tr.arrearsAmount).toBe(1000);

    const notYetOverdueAnchor = computeRentTrackerStats(payments, "2026-05-01", NO_RENT_ROLL);
    expect(notYetOverdueAnchor.overdueCount).toBe(0);
    expect(notYetOverdueAnchor.arrearsAmount).toBe(0);
  });

  it("case 4: due this month, paid late next month — receipt attributes to paid month only", () => {
    const anchorMay = "2026-05-20";
    const payments = [
      pay({
        id: "d",
        due_date: "2026-05-28",
        paid_date: "2026-06-03",
        status: "paid",
      }),
    ];
    const ccMay = computeRentFinancialMonthKpis(toFinanceInputs(payments), anchorMay);
    expect(ccMay.rentScheduledThisMonth).toBe(1000);
    expect(ccMay.rentCollectedThisMonth).toBe(0);

    expectOverlappingStripeMatches(payments, anchorMay, NO_RENT_ROLL);

    const ccJune = computeRentFinancialMonthKpis(toFinanceInputs(payments), "2026-06-10");
    expect(ccJune.rentCollectedThisMonth).toBe(1000);
    expect(ccJune.rentScheduledThisMonth).toBe(0);
  });

  it("case 5: due next calendar month pending — next-month bucket ≠ 30-day pipeline (both defined, different filters)", () => {
    const anchor = "2026-05-15";
    const payments = [
      pay({
        id: "e",
        due_date: "2026-06-03",
        status: "pending",
      }),
    ];
    const cc = computeRentFinancialMonthKpis(toFinanceInputs(payments), anchor);
    expect(cc.rentExpectedNextMonth).toBe(1000);
    expect(cc.rentScheduledThisMonth).toBe(0);

    const tr = computeRentTrackerStats(payments, anchor, NO_RENT_ROLL);
    expect(tr.nextUnpaidPipeline30d).toBe(1000);

    /** Far next month outside 30-day window from anchor: CC still schedules calendar “July”, pipeline may be zero. */
    const far = [
      pay({
        id: "f",
        due_date: "2026-07-08",
        status: "pending",
      }),
    ];
    const ccFar = computeRentFinancialMonthKpis(toFinanceInputs(far), anchor);
    expect(ccFar.rentExpectedNextMonth).toBe(0); // next calendar month is June, not July
    const trFar = computeRentTrackerStats(far, anchor, NO_RENT_ROLL);
    expect(trFar.nextUnpaidPipeline30d).toBe(0); // 2026-05-15 + 30d = 2026-06-14 < July 8
  });

  it("case 6: multiple missed months — arrears aggregates all overdue unpaid; current-month due strip stays month-scoped", () => {
    const anchor = "2026-05-22";
    const payments = [
      pay({ id: "m1", due_date: "2026-03-01", amount: 500, status: "pending" }),
      pay({ id: "m2", due_date: "2026-04-01", amount: 700, status: "pending" }),
    ];
    const tr = computeRentTrackerStats(payments, anchor, NO_RENT_ROLL);
    expect(tr.arrearsAmount).toBe(1200);
    expect(tr.overdueCount).toBe(2);
    expect(tr.outstandingThisMonth).toBe(0);

    const cc = computeRentFinancialMonthKpis(toFinanceInputs(payments), anchor);
    expect(cc.rentDueThisMonth).toBe(0);
    expect(cc.rentScheduledThisMonth).toBe(0);
    expectOverlappingStripeMatches(payments, anchor, NO_RENT_ROLL);
  });

  it("case 7: month start / month end — due on anchor day is pending but not strictly overdue same ISO day", () => {
    const paymentsFirst = [
      pay({ id: "s1", due_date: "2026-05-01", status: "pending", amount: 100 }),
    ];
    expect(computeRentTrackerStats(paymentsFirst, "2026-05-01", NO_RENT_ROLL).overdueCount).toBe(0);

    /** Day after due: overdue. */
    expect(computeRentTrackerStats(paymentsFirst, "2026-05-02", NO_RENT_ROLL).overdueCount).toBe(1);

    /** Last day of May: due still this month outstanding. */
    const paymentsMonthEndDue = [
      pay({ id: "s2", due_date: "2026-05-31", status: "pending", amount: 400 }),
    ];
    const anchorLastDayMay = "2026-05-31";
    const cc = computeRentFinancialMonthKpis(toFinanceInputs(paymentsMonthEndDue), anchorLastDayMay);
    expect(cc.rentScheduledThisMonth).toBe(400);
    expect(cc.rentDueThisMonth).toBe(400);

    /** Overdue semantics: pending with due on last day vs anchor next morning. */
    expect(computeRentTrackerStats(paymentsMonthEndDue, anchorLastDayMay, NO_RENT_ROLL).overdueCount).toBe(0);
    expect(computeRentTrackerStats(paymentsMonthEndDue, "2026-06-01", NO_RENT_ROLL).overdueCount).toBe(1);
  });

  it("rent roll overlays scheduled-this-month totals (parity with Rent Tracker Expected Mo)", () => {
    const payments = [
      pay({ id: "r1", due_date: "2026-05-10", status: "pending", amount: 950 }),
    ];
    const cc = computeRentFinancialMonthKpis(toFinanceInputs(payments), "2026-05-12", {
      activeMonthlyRentRoll: 1200,
    });
    const tr = computeRentTrackerStats(payments, "2026-05-12", RENT_ROLL_1200);
    expect(cc.rentScheduledThisMonth).toBe(1200);
    expect(tr.expectedThisMonth).toBe(1200);
    expect(tr.receivedThisMonth).toBe(cc.rentCollectedThisMonth);
    expect(tr.outstandingThisMonth).toBe(cc.rentDueThisMonth);
  });

  it("legacy paid with no paid_date: receipt counts in due month", () => {
    const payments = [
      pay({
        id: "leg",
        due_date: "2026-05-15",
        paid_date: null,
        status: "paid",
      }),
    ];
    expectOverlappingStripeMatches(payments, "2026-05-20", NO_RENT_ROLL);
    const cc = computeRentFinancialMonthKpis(toFinanceInputs(payments), "2026-05-20");
    expect(cc.rentCollectedThisMonth).toBe(1000);
  });
});
