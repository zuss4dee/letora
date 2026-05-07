/** Client-only persistence: which spreadsheet lines the user dismissed from the batch review queue. */

const STORAGE_PREFIX = "letora:importBatchReviewedLines:";

function storageKey(batchId: string): string {
  return `${STORAGE_PREFIX}${batchId}`;
}

function validLinesFromQueue(
  queue: ReadonlyArray<{ row: { line: number } }>,
): Set<number> {
  return new Set(queue.map(({ row }) => row.line));
}

/** Load stored lines that still exist in this batch snapshot. Drops stale keys. */
export function loadDismissedReviewLines(
  batchId: string,
  queue: ReadonlyArray<{ row: { line: number } }>,
): Set<number> {
  if (typeof window === "undefined") return new Set();
  const valid = validLinesFromQueue(queue);
  try {
    const raw = window.localStorage.getItem(storageKey(batchId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const out = new Set<number>();
    for (const x of parsed) {
      if (typeof x === "number" && Number.isFinite(x) && valid.has(x)) out.add(x);
    }
    return out;
  } catch {
    return new Set();
  }
}

export function saveDismissedReviewLines(batchId: string, lines: Set<number>): void {
  try {
    window.localStorage.setItem(storageKey(batchId), JSON.stringify([...lines].sort((a, b) => a - b)));
  } catch {
    /* quota / private mode */
  }
}

/** Persist only lines that belong to `queue` — keeps storage tight if import payload changes */
export function mergeDismissedWithQueue(
  batchId: string,
  lines: Set<number>,
  queue: ReadonlyArray<{ row: { line: number } }>,
): Set<number> {
  const valid = validLinesFromQueue(queue);
  const next = new Set<number>();
  for (const line of lines) {
    if (valid.has(line)) next.add(line);
  }
  saveDismissedReviewLines(batchId, next);
  return next;
}
