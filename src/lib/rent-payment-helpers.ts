/**
 * Pure rent payment helpers — safe to import from Client Components.
 * (Kept separate from `@/lib/rent-utils` which pulls Supabase server client for totals.)
 */

/**
 * Checks if a payment is overdue based on its status and due date.
 * Consistent with Rent Tracker and Dashboard logic.
 */
export function isPaymentOverdue(
  status: string | null,
  dueDate: string | null,
  todayIso: string,
): boolean {
  const st = (status ?? "").toLowerCase();
  return st === "overdue" || (st === "pending" && dueDate != null && dueDate < todayIso);
}

/**
 * GBP amount for one instalment. Canonical column is `public.rent_payments.amount` (rent_tracker).
 * Optionally falls back to legacy `amount_due` only when present on an in-memory row (never SELECT it if absent in DB).
 */
export function resolvePaymentAmount(row: { amount?: unknown; amount_due?: unknown }): number {
  const raw = row.amount ?? row.amount_due;
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}
