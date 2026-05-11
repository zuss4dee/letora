import { describe, expect, it } from "vitest";

import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";

import { computeRentTrackerStats } from "./rent-tracker-stats";

function pay(overrides: Partial<RentPaymentListRow>): RentPaymentListRow {
  return {
    id: "p1",
    amount: 1000,
    due_date: "2026-03-01",
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

describe("computeRentTrackerStats", () => {
  const anchor = "2026-03-15";

  it("uses rent roll vs scheduled so Expected differs from Outstanding when roll is richer", () => {
    const tenancies = [
      { monthlyRent: 1200, status: "active" },
      { monthlyRent: 800, status: "active" },
    ];
    const payments = [
      pay({ id: "a", amount: 1200, due_date: "2026-03-05", status: "pending" }),
    ];
    const s = computeRentTrackerStats(payments, anchor, tenancies);
    expect(s.expectedThisMonth).toBe(2000);
    expect(s.outstandingThisMonth).toBe(1200);
    expect(s.receivedThisMonth).toBe(0);
  });

  it("falls back Expected to instalments scheduled this month when rent roll is zero", () => {
    const payments = [pay({ id: "b", amount: 950, due_date: "2026-03-10", status: "pending" })];
    const s = computeRentTrackerStats(payments, anchor, []);
    expect(s.expectedThisMonth).toBe(950);
    expect(s.outstandingThisMonth).toBe(950);
  });

  it("counts Collected only on paid_date in month (distinct from instalments due)", () => {
    const payments = [
      pay({
        id: "c",
        amount: 800,
        due_date: "2026-02-01",
        paid_date: "2026-03-02",
        status: "paid",
      }),
    ];
    const s = computeRentTrackerStats(payments, anchor, []);
    expect(s.receivedThisMonth).toBe(800);
    expect(s.outstandingThisMonth).toBe(0);
  });

  it("sums next unpaid pipeline in (today, today+30d] only — no fabricated fallback", () => {
    const payments = [
      pay({ id: "d", amount: 400, due_date: "2026-03-20", status: "pending" }),
      pay({ id: "e", amount: 500, due_date: "2026-05-01", status: "pending" }),
    ];
    const s = computeRentTrackerStats(payments, anchor, []);
    expect(s.nextUnpaidPipeline30d).toBe(400);
  });

  it("includes prior-month unpaid instalments in Still Due (carried arrears)", () => {
    const payments = [
      pay({ id: "arr", amount: 450, due_date: "2026-02-01", status: "pending" }),
      pay({ id: "cur", amount: 600, due_date: "2026-03-28", status: "pending" }),
    ];
    const s = computeRentTrackerStats(payments, anchor, []);
    expect(s.outstandingThisMonth).toBe(1050);
    expect(s.expectedThisMonth).toBe(600);
  });

  it("clears Outstanding for current-month instalments when paid", () => {
    const payments = [
      pay({
        id: "f",
        amount: 600,
        due_date: "2026-03-01",
        paid_date: "2026-03-01",
        status: "paid",
      }),
    ];
    const tenancies = [{ monthlyRent: 600, status: "active" }];
    const s = computeRentTrackerStats(payments, anchor, tenancies);
    expect(s.expectedThisMonth).toBe(600);
    expect(s.outstandingThisMonth).toBe(0);
    expect(s.receivedThisMonth).toBe(600);
  });
});
