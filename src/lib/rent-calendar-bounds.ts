/**
 * Pure calendar arithmetic on YYYY-MM-DD anchors (timezone-stable; compare to DB `date`).
 */
export function monthBoundsIso(anchorIsoDate: string, offsetMonths: number): { startIso: string; endIso: string } {
  const parts = anchorIsoDate.slice(0, 10).split("-").map(Number);
  const y = parts[0] ?? new Date().getUTCFullYear();
  const m = parts[1] ?? 1;
  const base = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  const startY = base.getUTCFullYear();
  const startM = base.getUTCMonth();
  const startIso = `${startY}-${String(startM + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(startY, startM + 1, 0)).getUTCDate();
  const endIso = `${startY}-${String(startM + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startIso, endIso };
}

/** Inclusive ISO date comparison: `a <= b`. */
export function isoDateBetweenInclusive(iso: string | null | undefined, startIso: string, endIso: string): boolean {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  return d >= startIso && d <= endIso;
}

export function addCalendarDaysIso(startIsoDate: string, days: number): string {
  const [y, m, d] = startIsoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
