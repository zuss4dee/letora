/**
 * Single field for display: `properties.address` should be the full line.
 * Legacy data sometimes duplicated ", city, postcode" when those were appended
 * even though `address` already contained them. This normalizes common cases.
 */
export function normalizePropertyAddressLabel(raw: string | null | undefined): string {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s) return "";

  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 4) return s;

  const n = parts.length;

  // Pattern: …, city, region, postcode, city, postcode (duplicate city + postcode at end)
  if (n >= 6 && parts[1] === parts[n - 2] && parts[3] === parts[n - 1]) {
    s = parts.slice(0, -2).join(", ");
    return s;
  }

  // Pattern: …, A, B, A, B (consecutive duplicate pair at end)
  if (n >= 4) {
    const a = parts[n - 4]!;
    const b = parts[n - 3]!;
    const c = parts[n - 2]!;
    const d = parts[n - 1]!;
    if (a === c && b === d) {
      return parts.slice(0, -2).join(", ");
    }
  }

  // Trailing pair repeats an earlier consecutive pair
  const last = parts[n - 1]!;
  const prev = parts[n - 2]!;
  for (let j = 0; j < n - 2; j++) {
    if (parts[j] === prev && parts[j + 1] === last) {
      return parts.slice(0, -2).join(", ");
    }
  }

  return s;
}
