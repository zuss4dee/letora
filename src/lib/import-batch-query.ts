const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Validated batch id from `?importBatch=` for list-page scoping. */
export function parseImportBatchParam(searchParams: {
  importBatch?: string | string[];
}): string | undefined {
  const raw = searchParams.importBatch;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return undefined;
  const id = v.trim();
  return UUID_RE.test(id) ? id : undefined;
}

export function importBatchShortLabel(batchId: string): string {
  return batchId.slice(0, 8).toUpperCase();
}
