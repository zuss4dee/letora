import { describe, expect, it } from "vitest";

import { buildRentPaymentArrearCandidateOrFilter, matchesRentPaymentArrearSqlCandidate } from "./rent-payment-arrear-candidate";
import { isPaymentOverdue } from "./rent-payment-helpers";

describe("buildRentPaymentArrearCandidateOrFilter", () => {
  it("builds the PostgREST or string with the UTC date anchor embedded", () => {
    expect(buildRentPaymentArrearCandidateOrFilter("2026-05-04")).toBe(
      "status.ilike.overdue,and(status.ilike.pending,due_date.lt.2026-05-04)",
    );
  });
});

describe("matchesRentPaymentArrearSqlCandidate vs isPaymentOverdue", () => {
  const today = "2026-05-04";
  const yesterday = "2026-05-03";
  const tomorrow = "2026-05-05";

  it("keeps helpers identical (single source of truth)", () => {
    const cases: Array<[string | null, string | null]> = [
      [null, null],
      ["", null],
      ["paid", today],
      ["OVERDUE", tomorrow],
      ["pending", yesterday],
      ["pending", today],
      ["pending", tomorrow],
      ["PENDING", null],
      ["partially_paid", yesterday],
      [" open ", yesterday],
    ];
    for (const [status, due] of cases) {
      expect(isPaymentOverdue(status, due, today)).toBe(matchesRentPaymentArrearSqlCandidate(status, due, today));
    }
  });

  describe("status = overdue (case-insensitive)", () => {
    it("is overdue regardless of due_date (even future)", () => {
      expect(matchesRentPaymentArrearSqlCandidate("overdue", tomorrow, today)).toBe(true);
      expect(matchesRentPaymentArrearSqlCandidate("OVERDUE", null, today)).toBe(true);
    });
  });

  describe("status = pending", () => {
    it("counts as candidate only when due_date is strictly before todayIso", () => {
      expect(matchesRentPaymentArrearSqlCandidate("pending", yesterday, today)).toBe(true);
      expect(matchesRentPaymentArrearSqlCandidate("pending", today, today)).toBe(false);
      expect(matchesRentPaymentArrearSqlCandidate("pending", tomorrow, today)).toBe(false);
    });

    it("does not match when due_date is null", () => {
      expect(matchesRentPaymentArrearSqlCandidate("pending", null, today)).toBe(false);
    });
  });

  describe("non-arrears statuses", () => {
    it("paid and other tokens are excluded", () => {
      expect(matchesRentPaymentArrearSqlCandidate("paid", yesterday, today)).toBe(false);
      expect(matchesRentPaymentArrearSqlCandidate("completed", yesterday, today)).toBe(false);
    });
  });

  describe("messy / unexpected strings", () => {
    it("does not treat whitespace-padded tokens as pending or overdue (matches ILIKE whole-string equality)", () => {
      expect(matchesRentPaymentArrearSqlCandidate(" pending", yesterday, today)).toBe(false);
      expect(matchesRentPaymentArrearSqlCandidate("overdue ", yesterday, today)).toBe(false);
    });

    it("does not substring-match pending or overdue", () => {
      expect(matchesRentPaymentArrearSqlCandidate("not_pending", yesterday, today)).toBe(false);
      expect(matchesRentPaymentArrearSqlCandidate("xoverdue", null, today)).toBe(false);
    });

    /**
     * If `status` contained SQL LIKE metacharacters, Postgres `ilike` could diverge from this TS model.
     * Product assumes plain ASCII status tokens — documented in `rent-payment-arrear-candidate.ts`.
     */
    it("documents LIKE metacharacter edge (behaviour is not special-cased in TS)", () => {
      expect(matchesRentPaymentArrearSqlCandidate("%", yesterday, today)).toBe(false);
      expect(matchesRentPaymentArrearSqlCandidate("_", yesterday, today)).toBe(false);
    });
  });
});
