/**
 * Dashboard hot-path: PostgREST filter used to narrow `rent_payments` before arrears KPI math.
 *
 * Semantics match {@link isPaymentOverdue} for normal stored values (`status` is plain ASCII tokens like
 * `pending` / `overdue`; `due_date` compares with `<` against UTC `YYYY-MM-DD` strings).
 *
 * **Known intentional caveats** (unlikely in product data):
 * - PostgREST `ilike` treats `%` and `_` in the **pattern** as LIKE wildcards. Our patterns are literal
 *   `overdue` / `pending` with no wildcards — safe.
 * - If patterns ever gained `%` / `_`, PostgreSQL and this TypeScript model could diverge until updated here.
 * - PostgreSQL collation case-folding may differ from `String.prototype.toLowerCase()` for exotic Unicode;
 *   product statuses are ASCII.
 */

/**
 * PostgREST `.or(...)` string for rent rows that are arrears *candidates* (narrowing query).
 * Keep literals `overdue` / `pending` aligned with {@link matchesRentPaymentArrearSqlCandidate}.
 */
export function buildRentPaymentArrearCandidateOrFilter(todayIso: string): string {
  return `status.ilike.overdue,and(status.ilike.pending,due_date.lt.${todayIso})`;
}

/**
 * TypeScript model of the SQL candidate predicate (PostgREST `ilike` with **no** wildcards in the pattern).
 * `isPaymentOverdue` in `rent-payment-helpers.ts` delegates here so dashboard PostgREST narrowing and app
 * logic cannot drift.
 */
export function matchesRentPaymentArrearSqlCandidate(
  status: string | null,
  dueDate: string | null,
  todayIso: string,
): boolean {
  return (
    statusIlikeNoMetacharacters(status, "overdue") ||
    (statusIlikeNoMetacharacters(status, "pending") &&
      dueDate != null &&
      dueDate < todayIso)
  );
}

/**
 * When the ILIKE pattern has no `%` or `_`, PostgreSQL matches the whole column case-insensitively.
 */
function statusIlikeNoMetacharacters(status: string | null, pattern: string): boolean {
  if (status == null) return false;
  return status.toLowerCase() === pattern.toLowerCase();
}
