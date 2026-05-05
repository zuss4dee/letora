import type { RentPaymentListRow } from "@/lib/actions/rent-tracker";
import { isoDateBetweenInclusive, monthBoundsIso } from "@/lib/rent-calendar-bounds";
import { isPaymentOverdue } from "@/lib/rent-payment-helpers";

/**
 * Stable `?mode=` tokens for `/dashboard/rent-tracker` (Command Center KPI deep-links use the same names).
 * Precedence (URL → list):
 * 1. `scopeRentTrackerData` resolves `paymentId`, `tenancyId`, `tenantId`, `propertyId` onto the ledger first.
 * 2. `mode` narrows whichever instalments survived step 1.
 * 3. Valid `paymentId` that survives scoping **always stays visible**: if it would drop out under the active mode,
 *    we union it back in (paused mode filter). Other id params intersect only via the scoped roster — no widening.
 *
 * Mirrors calendar windows + paid attribution in `loadCommandCenterFinancials` (`command-center-queries.ts`).
 */
export const RENT_TRACKER_DISPLAY_MODES = [
  "arrears",
  "due_this_month",
  "collected_this_month",
  "scheduled_this_month",
  "scheduled_next_month",
  "collected_last_month",
] as const;

export type RentTrackerDisplayMode = (typeof RENT_TRACKER_DISPLAY_MODES)[number];
export type RentTrackerResolvedDisplayMode = "all" | RentTrackerDisplayMode;

export const RENT_TRACKER_MODE_OPERATOR_LABELS: Record<RentTrackerDisplayMode, string> = {
  arrears: "Total arrears",
  due_this_month: "Still due · this month",
  collected_this_month: "Collected · this month",
  scheduled_this_month: "Scheduled · this month",
  scheduled_next_month: "Scheduled · next month",
  collected_last_month: "Collected · last month",
};

const MODE_SET = new Set<string>(RENT_TRACKER_DISPLAY_MODES);

function isPaidRentStatus(status: string | null): boolean {
  return (status ?? "").toLowerCase() === "paid";
}

function parseModeToken(raw: string | string[] | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toLowerCase();
  return t.length > 0 ? t : undefined;
}

export function parseRentTrackerModeParam(raw: string | string[] | undefined): {
  canonical: RentTrackerResolvedDisplayMode;
  unknownToken?: string;
} {
  const token = parseModeToken(raw);
  if (!token) return { canonical: "all" };
  if (MODE_SET.has(token)) return { canonical: token as RentTrackerDisplayMode };
  return { canonical: "all", unknownToken: token };
}

export function paymentMatchesRentTrackerDisplayMode(
  p: Pick<RentPaymentListRow, "status" | "due_date" | "paid_date">,
  mode: RentTrackerDisplayMode,
  todayIso: string,
): boolean {
  const anchor = todayIso.slice(0, 10);
  const current = monthBoundsIso(anchor, 0);
  const next = monthBoundsIso(anchor, 1);
  const last = monthBoundsIso(anchor, -1);
  const due = (p.due_date ?? "").slice(0, 10);
  const paidIso = (p.paid_date ?? "").slice(0, 10);

  switch (mode) {
    case "scheduled_this_month":
      return Boolean(due && isoDateBetweenInclusive(due, current.startIso, current.endIso));

    case "due_this_month":
      return (
        Boolean(due && isoDateBetweenInclusive(due, current.startIso, current.endIso)) &&
        !isPaidRentStatus(p.status)
      );

    case "collected_this_month":
      if (!isPaidRentStatus(p.status)) return false;
      if (paidIso && isoDateBetweenInclusive(paidIso, current.startIso, current.endIso)) return true;
      if (!paidIso && due && isoDateBetweenInclusive(due, current.startIso, current.endIso)) return true;
      return false;

    case "scheduled_next_month":
      return Boolean(due && isoDateBetweenInclusive(due, next.startIso, next.endIso));

    case "collected_last_month":
      if (!isPaidRentStatus(p.status)) return false;
      if (paidIso && isoDateBetweenInclusive(paidIso, last.startIso, last.endIso)) return true;
      if (!paidIso && due && isoDateBetweenInclusive(due, last.startIso, last.endIso)) return true;
      return false;

    case "arrears":
      return isPaymentOverdue(p.status, p.due_date, anchor);
  }
}

export function applyRentTrackerDisplayMode(
  payments: RentPaymentListRow[],
  mode: RentTrackerResolvedDisplayMode,
  todayIso: string,
  focusPaymentId?: string,
): { displayPayments: RentPaymentListRow[]; modePausedForFocus: boolean } {
  if (mode === "all") {
    return { displayPayments: payments, modePausedForFocus: false };
  }

  const filtered = payments.filter((p) => paymentMatchesRentTrackerDisplayMode(p, mode, todayIso));
  const focus = focusPaymentId?.trim();
  if (focus && payments.some((p) => p.id === focus) && !filtered.some((p) => p.id === focus)) {
    const keep = new Set(filtered.map((p) => p.id));
    keep.add(focus);
    return {
      displayPayments: payments.filter((p) => keep.has(p.id)),
      modePausedForFocus: true,
    };
  }

  return { displayPayments: filtered, modePausedForFocus: false };
}
