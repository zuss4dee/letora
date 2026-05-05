import { describe, expect, it } from "vitest";

import {
  applyRentTrackerDisplayMode,
  parseRentTrackerModeParam,
  paymentMatchesRentTrackerDisplayMode,
} from "./rent-tracker-url-mode";
import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";

function row(partial: Partial<RentPaymentListRow> & Pick<RentPaymentListRow, "id">): RentPaymentListRow {
  return {
    id: partial.id,
    amount: partial.amount ?? 100,
    status: partial.status ?? "pending",
    due_date: partial.due_date ?? null,
    paid_date: partial.paid_date ?? null,
    tenancyId: partial.tenancyId ?? null,
    tenantId: partial.tenantId ?? null,
    tenantName: partial.tenantName ?? null,
    propertyAddress: partial.propertyAddress ?? null,
  };
}

describe("parseRentTrackerModeParam", () => {
  it("normalises allowlisted tokens", () => {
    expect(parseRentTrackerModeParam("ARREARS").canonical).toBe("arrears");
    expect(parseRentTrackerModeParam(" due_this_month ").canonical).toBe("due_this_month");
  });

  it("drops unknown tokens", () => {
    expect(parseRentTrackerModeParam("nope")).toEqual({ canonical: "all", unknownToken: "nope" });
  });
});

describe("paymentMatchesRentTrackerDisplayMode", () => {
  const today = "2026-05-05";

  it("classifies due this month unpaid", () => {
    const p = row({ id: "1", due_date: "2026-05-10", status: "pending" });
    expect(paymentMatchesRentTrackerDisplayMode(p, "due_this_month", today)).toBe(true);
    expect(paymentMatchesRentTrackerDisplayMode(p, "collected_this_month", today)).toBe(false);
  });

  it("unions focus row in applyRentTrackerDisplayMode", () => {
    const paidThisMonth = row({ id: "a", due_date: "2026-05-01", status: "paid", paid_date: "2026-05-02" });
    const arrears = row({ id: "b", due_date: "2026-01-01", status: "pending" });
    const payments = [paidThisMonth, arrears];

    const dueOnly = applyRentTrackerDisplayMode(payments, "due_this_month", today, undefined);
    expect(dueOnly.displayPayments.map((x) => x.id)).toEqual([]);

    const withFocus = applyRentTrackerDisplayMode(payments, "due_this_month", today, "b");
    expect(withFocus.modePausedForFocus).toBe(true);
    expect(withFocus.displayPayments.map((x) => x.id).sort()).toEqual(["b"]);
  });
});
