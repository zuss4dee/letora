import { describe, expect, it } from "vitest";

import {
  combinedPropertyHaystack,
  extractUkPostcodeNormalized,
  nameAndCityHaystack,
  normalizePropertyHintForMatch,
  pass1PropertyNameInHint,
  pass2StoredHaystackContainsHint,
  pass3PostcodeWhenStoredHasPostcode,
  pass4TokenOverlapRatio,
  resolvePropertyRowsForDraftHint,
  stripUkPostcodesForTokenMatch,
  type PropertyRowForMatch,
} from "./property-match";

const row = (id: string, name: string | null, address: string | null, city: string | null): PropertyRowForMatch => ({
  id,
  name,
  address,
  city,
});

describe("pass1PropertyNameInHint", () => {
  it("matches when stored name is a substring of the chat hint (name + city only in DB)", () => {
    const r = row("1", "101 Billionaires Row", null, "London");
    expect(pass1PropertyNameInHint(r, "101 Billionaires Row, London, L1 56AA")).toBe(true);
  });

  it("matches simple hint without postcode noise", () => {
    const r = row("1", "101 Billionaires Row", null, "London");
    expect(pass1PropertyNameInHint(r, "101 Billionaires Row, London")).toBe(true);
  });

  it("returns false when name does not appear in hint", () => {
    const r = row("1", "99 Other Street", null, "London");
    expect(pass1PropertyNameInHint(r, "101 Billionaires Row, London")).toBe(false);
  });

  it("bidirectional: matches when hint is a substring of name (partial hint)", () => {
    const r = row("1", "101 Billionaires Row", null, "London");
    expect(pass1PropertyNameInHint(r, "101 billionaires")).toBe(true);
  });

  it("matches case-insensitive exact name vs hint", () => {
    const r = row("1", "101 Billionaires Row", null, "London");
    expect(pass1PropertyNameInHint(r, "101 billionaires row")).toBe(true);
  });

  it("rejects very short hints even if they appear in name", () => {
    const r = row("1", "101 Billionaires Row", null, "London");
    expect(pass1PropertyNameInHint(r, "101")).toBe(false);
  });
});

describe("pass2StoredHaystackContainsHint", () => {
  it("matches when combined haystack contains full hint", () => {
    const r = row("1", "Flat 2", "101 Billionaires Row", "Manchester");
    expect(pass2StoredHaystackContainsHint(r, "101 Billionaires Row Manchester")).toBe(true);
  });

  it("is case-insensitive", () => {
    const r = row("1", null, "10 Test Street", "Leeds");
    expect(pass2StoredHaystackContainsHint(r, "test street leeds")).toBe(true);
  });

  it("returns false when hint is not a substring of stored fields", () => {
    const r = row("1", null, "99 Other Road", "Bristol");
    expect(pass2StoredHaystackContainsHint(r, "101 Billionaires Row")).toBe(false);
  });
});

describe("pass3PostcodeWhenStoredHasPostcode", () => {
  it("matches UK postcodes with different spacing when stored has a postcode", () => {
    const r = row("1", null, "1 High St", "SW1A 1AA");
    expect(pass3PostcodeWhenStoredHasPostcode(r, "London SW1A1AA")).toBe(true);
  });

  it("returns false when stored haystack has no postcode even if hint has one", () => {
    const r = row("1", "101 Billionaires Row", null, "London");
    expect(pass3PostcodeWhenStoredHasPostcode(r, "101 Billionaires Row London L1 5AA")).toBe(false);
  });

  it("returns false when hint has no postcode", () => {
    const r = row("1", null, "1 High St London", "SW1A 1AA");
    expect(pass3PostcodeWhenStoredHasPostcode(r, "High St London")).toBe(false);
  });
});

describe("extractUkPostcodeNormalized", () => {
  it("normalizes compact form", () => {
    expect(extractUkPostcodeNormalized("L1 5AA")).toBe("L15AA");
  });
});

describe("stripUkPostcodesForTokenMatch", () => {
  it("removes postcode-like segments from hint for token scoring", () => {
    const s = stripUkPostcodesForTokenMatch("101 row london l1 5aa");
    expect(s).not.toMatch(/l1\s*5aa/i);
  });
});

describe("pass4TokenOverlapRatio", () => {
  it("scores using name + city with postcode stripped from hint", () => {
    const r = row("1", "101 Billionaires Row", null, "London");
    const ratio = pass4TokenOverlapRatio(r, "101 Billionaires Row, London, L1 56AA");
    expect(ratio).toBeGreaterThanOrEqual(0.5);
  });

  it("returns 0 when nothing overlaps", () => {
    const r = row("1", null, "ZZZ Nowhere", null);
    expect(pass4TokenOverlapRatio(r, "Completely Different Place")).toBe(0);
  });
});

describe("combinedPropertyHaystack", () => {
  it("joins name address city", () => {
    expect(combinedPropertyHaystack(row("1", "A", "B", "C"))).toBe("A B C");
  });
});

describe("nameAndCityHaystack", () => {
  it("joins name and city only", () => {
    expect(nameAndCityHaystack(row("1", "Street", null, "London"))).toBe("Street London");
  });
});

describe("normalizePropertyHintForMatch", () => {
  it("strips punctuation and collapses spaces", () => {
    expect(normalizePropertyHintForMatch("  Hello,  World!  ")).toBe("hello world");
  });
});

describe("resolvePropertyRowsForDraftHint", () => {
  it("pass 5: single property on account uses matched_by_fallback when nothing else matched", () => {
    const rows = [row("p1", "Solo House", "1 Lane", "X")];
    const res = resolvePropertyRowsForDraftHint(rows, "random chat text", 1);
    expect(res.kind).toBe("matched_by_fallback");
    if (res.kind === "matched_by_fallback") expect(res.row.id).toBe("p1");
  });

  it("matches real scenario: name + city only in DB, hint with extra postcode", () => {
    const rows = [row("p1", "101 Billionaires Row", null, "London")];
    const res = resolvePropertyRowsForDraftHint(rows, "101 Billionaires Row, London, L1 56AA", 1);
    expect(res.kind).toBe("matched");
    if (res.kind === "matched") {
      expect(res.row.id).toBe("p1");
      expect(res.pass).toBe(1);
    }
  });

  it("pass 1 or 2: unique substring match (address in address column hits pass 1 first)", () => {
    const rows = [
      row("a", null, "10 Alpha Street", "Leeds"),
      row("b", null, "99 Beta Road", "Manchester"),
    ];
    const res = resolvePropertyRowsForDraftHint(rows, "10 Alpha Street Leeds", 2);
    expect(res.kind).toBe("matched");
    if (res.kind === "matched") {
      expect(res.pass).toBe(1);
      expect(res.row.id).toBe("a");
    }
  });

  it("pass 6: multiple name matches returns ambiguous_match", () => {
    const rows = [
      row("a", "10 High Street", null, "London"),
      row("b", "10 High Street", null, "London"),
    ];
    const res = resolvePropertyRowsForDraftHint(rows, "10 High Street London", 2);
    expect(res.kind).toBe("ambiguous_match");
  });

  it("returns no_property_match for empty hint", () => {
    const res = resolvePropertyRowsForDraftHint([row("a", "x", "y", "z")], "   ", 1);
    expect(res.kind).toBe("no_property_match");
    if (res.kind === "no_property_match") expect(res.reason).toBe("empty_hint");
  });

  it("returns no_property_match for empty rows", () => {
    const res = resolvePropertyRowsForDraftHint([], "Some address", 0);
    expect(res.kind).toBe("no_property_match");
    if (res.kind === "no_property_match") expect(res.reason).toBe("no_rows");
  });
});
