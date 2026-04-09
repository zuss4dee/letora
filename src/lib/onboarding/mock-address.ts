/**
 * Deterministic “instant lookup” for onboarding — feels fast without calling a geocoder.
 */
export type MockResolvedAddress = {
  line1: string;
  postcode: string;
  city: string;
};

const UK_POSTCODE = /\b([A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2})\b/i;

function normalizePostcode(pc: string): string {
  const compact = pc.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 3) return pc.trim().toUpperCase();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function mockResolveUkAddress(raw: string): MockResolvedAddress {
  const t = raw.trim();
  if (!t) {
    return { line1: "1 Merchant Square", postcode: "W2 1AY", city: "London" };
  }

  const m = t.match(UK_POSTCODE);
  const postcode = m ? normalizePostcode(m[1]!) : "EC1A 1BB";
  const without = m ? t.replace(m[0], "").trim().replace(/,\s*$/u, "").trim() : t;

  const parts = without
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const city = parts[parts.length - 1]!;
    const line1 = parts.slice(0, -1).join(", ") || parts[0]!;
    return { line1, postcode, city };
  }

  if (parts.length === 1) {
    return { line1: parts[0]!, postcode, city: "London" };
  }

  return { line1: "1 Merchant Square", postcode, city: "London" };
}
