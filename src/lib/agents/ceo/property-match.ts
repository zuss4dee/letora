/**
 * Multi-pass matching from a chat address hint to stored property rows (name, address, city).
 * Optimised for real data where **name** holds the street label and city/postcode may be split or partial.
 */

export type PropertyRowForMatch = {
  id: string;
  name?: string | null;
  address: string | null;
  city: string | null;
};

export type PropertyMatchReason = "empty_hint" | "no_rows" | "no_overlap";

export type PropertyMatchResolveResult =
  | { kind: "matched"; row: PropertyRowForMatch; pass: 1 | 2 | 3 | 4 }
  | { kind: "matched_by_fallback"; row: PropertyRowForMatch; pass: 5 }
  | { kind: "ambiguous_match"; candidates: PropertyRowForMatch[]; pass: 6 }
  | { kind: "no_property_match"; reason: PropertyMatchReason };

/** UK outward + inward (flexible spacing). */
const UK_POSTCODE_REGEX = /\b([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})\b/i;

const TOKEN_STOP_WORDS = new Set([
  "flat",
  "floor",
  "unit",
  "the",
  "road",
  "street",
  "avenue",
  "lane",
  "drive",
  "close",
  "crescent",
  "way",
  "place",
  "court",
  "gardens",
  "uk",
  "england",
  "london",
  "gb",
]);

const TOKEN_MATCH_THRESHOLD = 0.5;

export function normalizePropertyHintForMatch(hint: string): string {
  return hint
    .toLowerCase()
    .replace(/[·•]/g, " ")
    .replace(/[.,#!'"?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function combinedPropertyHaystack(row: PropertyRowForMatch): string {
  return [row.name ?? "", row.address ?? "", row.city ?? ""].filter(Boolean).join(" ").trim();
}

/** Name + city only (typical when address line is empty in DB). */
export function nameAndCityHaystack(row: PropertyRowForMatch): string {
  return [row.name ?? "", row.city ?? ""].filter(Boolean).join(" ").trim();
}

export function normalizeHaystackForMatch(hay: string): string {
  return hay
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[.,#'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractUkPostcodeNormalized(text: string): string | null {
  const m = text.toUpperCase().match(UK_POSTCODE_REGEX);
  if (!m) return null;
  return m[1].replace(/\s+/g, "");
}

/** Remove UK postcode tokens so chat hints that invent a postcode do not add noise to token overlap. */
export function stripUkPostcodesForTokenMatch(s: string): string {
  return s
    .replace(/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pass 1 — bidirectional substring: stored **address** (or legacy name) inside hint OR hint inside that string. */
export function pass1PropertyNameInHint(row: PropertyRowForMatch, hint: string): boolean {
  const raw = row.address?.trim() || row.name?.trim();
  if (!raw) return false;
  const nameNorm = normalizePropertyHintForMatch(raw);
  if (nameNorm.length < 2) return false;
  const h = normalizePropertyHintForMatch(hint);
  if (h.length < 4) return false;
  return h.includes(nameNorm) || nameNorm.includes(h);
}

/** Pass 2 — full normalised hint is a substring of stored name + address + city (hint-in-stored). */
export function pass2StoredHaystackContainsHint(row: PropertyRowForMatch, hint: string): boolean {
  const h = normalizePropertyHintForMatch(hint);
  if (!h) return false;
  const hay = normalizeHaystackForMatch(combinedPropertyHaystack(row));
  if (!hay) return false;
  return hay.includes(h);
}

/**
 * Pass 3 — Postcode match **only** when the stored record actually contains a postcode.
 * Ignores postcodes present only in the chat hint when DB has none (avoids false negatives).
 */
export function pass3PostcodeWhenStoredHasPostcode(row: PropertyRowForMatch, hint: string): boolean {
  const hay = combinedPropertyHaystack(row);
  const pcHay = extractUkPostcodeNormalized(hay);
  if (!pcHay) return false;
  const pcHint = extractUkPostcodeNormalized(hint);
  if (!pcHint) return false;
  return pcHay === pcHint;
}

function meaningfulTokensFromStrippedHint(strippedHint: string): string[] {
  const n = normalizePropertyHintForMatch(strippedHint);
  const raw = n.split(/[\s,/]+/).filter((w) => w.length > 0);
  return raw.filter((w) => {
    if (TOKEN_STOP_WORDS.has(w)) return false;
    if (/^[a-z]{1,2}\d/.test(w)) return true;
    if (/^\d+$/.test(w)) return true;
    return w.length >= 2;
  });
}

/**
 * Pass 4 — token overlap between (name + city, postcodes stripped) and hint (postcodes stripped).
 * Threshold 50%.
 */
export function pass4TokenOverlapRatio(row: PropertyRowForMatch, hint: string): number {
  const hayRaw = nameAndCityHaystack(row);
  const hay = normalizeHaystackForMatch(stripUkPostcodesForTokenMatch(hayRaw));
  if (!hay) return 0;
  const hintStripped = stripUkPostcodesForTokenMatch(hint);
  const tokens = meaningfulTokensFromStrippedHint(hintStripped);
  if (tokens.length === 0) return 0;
  const hits = tokens.filter((t) => hay.includes(t));
  return hits.length / tokens.length;
}

type TokenNarrowResult =
  | { type: "single"; row: PropertyRowForMatch }
  | { type: "multiple"; rows: PropertyRowForMatch[] }
  | { type: "none" };

function narrowByTokenOverlap(rows: PropertyRowForMatch[], hint: string): TokenNarrowResult {
  const scored = rows
    .map((r) => ({ r, s: pass4TokenOverlapRatio(r, hint) }))
    .filter((x) => x.s >= TOKEN_MATCH_THRESHOLD)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0) return { type: "none" };
  if (scored.length === 1) return { type: "single", row: scored[0]!.r };
  const top = scored[0]!.s;
  const ties = scored.filter((x) => x.s === top).map((x) => x.r);
  if (ties.length === 1) return { type: "single", row: ties[0]! };
  return { type: "multiple", rows: ties };
}

/**
 * Try to narrow a multi-match pool using postcode (when stored has one) then token overlap.
 */
function narrowMultiPool(pool: PropertyRowForMatch[], hint: string): PropertyMatchResolveResult | null {
  const p3 = pool.filter((r) => pass3PostcodeWhenStoredHasPostcode(r, hint));
  const afterPc = p3.length > 0 ? p3 : pool;
  const bt = narrowByTokenOverlap(afterPc, hint);
  if (bt.type === "single") return { kind: "matched", row: bt.row, pass: 4 };
  if (bt.type === "multiple") return { kind: "ambiguous_match", candidates: bt.rows, pass: 6 };
  return null;
}

/**
 * Multi-pass resolution. `rows` must be the full candidate set for this lookup (e.g. all properties
 * for the landlord). `accountPropertyCount` should be the total properties on the account (used for pass 5).
 */
export function resolvePropertyRowsForDraftHint(
  rows: PropertyRowForMatch[],
  hint: string,
  accountPropertyCount: number,
): PropertyMatchResolveResult {
  const hintTrim = hint.trim();
  if (!hintTrim) return { kind: "no_property_match", reason: "empty_hint" };
  if (rows.length === 0) return { kind: "no_property_match", reason: "no_rows" };

  const p1 = rows.filter((r) => pass1PropertyNameInHint(r, hintTrim));
  if (p1.length === 1) return { kind: "matched", row: p1[0]!, pass: 1 };
  if (p1.length > 1) {
    const n = narrowMultiPool(p1, hintTrim);
    if (n) return n;
    return { kind: "ambiguous_match", candidates: p1, pass: 6 };
  }

  const p2 = rows.filter((r) => pass2StoredHaystackContainsHint(r, hintTrim));
  if (p2.length === 1) return { kind: "matched", row: p2[0]!, pass: 2 };
  if (p2.length > 1) {
    const n = narrowMultiPool(p2, hintTrim);
    if (n) return n;
    return { kind: "ambiguous_match", candidates: p2, pass: 6 };
  }

  const p3 = rows.filter((r) => pass3PostcodeWhenStoredHasPostcode(r, hintTrim));
  if (p3.length === 1) return { kind: "matched", row: p3[0]!, pass: 3 };
  if (p3.length > 1) {
    const n = narrowMultiPool(p3, hintTrim);
    if (n) return n;
    return { kind: "ambiguous_match", candidates: p3, pass: 6 };
  }

  const p4 = rows.filter((r) => pass4TokenOverlapRatio(r, hintTrim) >= TOKEN_MATCH_THRESHOLD);
  if (p4.length === 1) return { kind: "matched", row: p4[0]!, pass: 4 };
  if (p4.length > 1) {
    const bt = narrowByTokenOverlap(p4, hintTrim);
    if (bt.type === "single") return { kind: "matched", row: bt.row, pass: 4 };
    if (bt.type === "multiple") return { kind: "ambiguous_match", candidates: bt.rows, pass: 6 };
    return { kind: "ambiguous_match", candidates: p4, pass: 6 };
  }

  if (accountPropertyCount === 1 && rows.length === 1) {
    return { kind: "matched_by_fallback", row: rows[0]!, pass: 5 };
  }

  return { kind: "no_property_match", reason: "no_overlap" };
}
