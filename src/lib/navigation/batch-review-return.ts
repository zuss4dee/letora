/**
 * Safe in-app return targets for import batch review — blocks open redirects.
 * Accepts path + optional hash: /dashboard/import/batch/<id>#review-row-<line>
 *
 * Validates: starts with "/", no scheme or "..", pathname must be under import batch routes,
 * hash (if present) must be `#review-row-<digits>` only.
 */
const SAFE_BATCH_REVIEW_RETURN = /^\/dashboard\/import\/batch\/[^/#?]+(#review-row-\d+)?$/;

export function reviewRowDomId(line: number): string {
  return `review-row-${line}`;
}

/** Path + hash (no origin) to append as returnTo. */
export function buildBatchReviewReturnHref(batchId: string, rowLine: number): string {
  return `/dashboard/import/batch/${batchId}#${reviewRowDomId(rowLine)}`;
}

export function parseSafeBatchReviewReturn(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  let decoded = raw.trim();
  if (decoded.length === 0) return null;
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/")) return null;
  if (decoded.includes("//") || decoded.includes("..")) return null;
  if (!SAFE_BATCH_REVIEW_RETURN.test(decoded)) return null;
  return decoded;
}

export function parseSafeBatchReviewReturnFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): string | null {
  const v = sp.returnTo;
  const s = Array.isArray(v) ? v[0] : v;
  return parseSafeBatchReviewReturn(s);
}

export function withReturnToQuery(entityPath: string, returnHref: string): string {
  const q = new URLSearchParams();
  q.set("returnTo", returnHref);
  const joiner = entityPath.includes("?") ? "&" : "?";
  return `${entityPath}${joiner}${q.toString()}`;
}
