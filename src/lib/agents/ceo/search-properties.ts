/** Pure helpers for CEO `search_properties` — testable without Supabase. */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PropertySearchRow = {
  id: string;
  address: string | null;
  city: string | null;
  postcode: string | null;
  monthly_rent: number | string | null;
};

export function tokenizeAddressQuery(query: string): string[] {
  const t = query.trim().toLowerCase();
  if (!t) return [];
  const parts = t.split(/[\s,]+/).filter((p) => p.length >= 2);
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    uniq.push(p);
  }
  return uniq.slice(0, 12);
}

function haystack(row: PropertySearchRow): string {
  return `${row.address ?? ""} ${row.city ?? ""} ${row.postcode ?? ""}`.toLowerCase();
}

/**
 * Score rows by how many query tokens appear in address/city/postcode.
 * Also boosts exact UUID match when `query` is a UUID.
 */
export function rankPropertySearch(
  query: string,
  rows: PropertySearchRow[],
  limit: number,
): { candidates: PropertySearchRow[]; hint: string | null } {
  const q = query.trim();
  if (!q) {
    return { candidates: [], hint: "Provide a non-empty search query (address fragment, postcode, or property UUID)." };
  }

  const trimmedUuid = q.replace(/[{}]/g, "");
  if (UUID_RE.test(trimmedUuid)) {
    const hit = rows.find((r) => r.id.toLowerCase() === trimmedUuid.toLowerCase());
    if (hit) {
      return {
        candidates: [hit],
        hint: "Matched by property UUID.",
      };
    }
  }

  const tokens = tokenizeAddressQuery(q);
  if (tokens.length === 0) {
    return {
      candidates: [],
      hint: "Use at least 2 characters in your search (e.g. postcode or street fragment).",
    };
  }

  const fullHay = haystack;
  const scored = rows
    .map((row) => {
      const h = fullHay(row);
      let score = 0;
      for (const tok of tokens) {
        if (h.includes(tok)) score += 1;
      }
      if (h.includes(q.toLowerCase())) score += 0.5;
      return { row, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, limit).map((s) => s.row);

  let hint: string | null = null;
  if (candidates.length === 0) {
    hint = "No properties matched. Try a postcode, city, or distinctive words from the address.";
  } else if (candidates.length > 1) {
    hint =
      "Multiple matches — pick the correct **property id** using city and monthly rent, then pass that UUID to onboarding tools (not the flat number alone).";
  }

  return { candidates, hint };
}

export function labelPropertyRow(row: PropertySearchRow): string {
  const parts = [row.address, row.city, row.postcode].filter(Boolean);
  const addr = parts.join(", ") || row.id;
  const rent =
    row.monthly_rent == null
      ? ""
      : typeof row.monthly_rent === "number"
        ? `£${row.monthly_rent}/mo`
        : `£${row.monthly_rent}/mo`;
  return rent ? `${addr} (${rent})` : addr;
}
