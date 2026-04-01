import { describe, expect, it } from "vitest";

import {
  rankPropertySearch,
  tokenizeAddressQuery,
  type PropertySearchRow,
} from "./search-properties";

describe("tokenizeAddressQuery", () => {
  it("splits and dedupes tokens", () => {
    expect(tokenizeAddressQuery("Apartment 706 Salford M3 7GX")).toEqual([
      "apartment",
      "706",
      "salford",
      "m3",
      "7gx",
    ]);
  });

  it("drops very short tokens", () => {
    expect(tokenizeAddressQuery("a bb cc")).toEqual(["bb", "cc"]);
  });
});

describe("rankPropertySearch", () => {
  const rows: PropertySearchRow[] = [
    {
      id: "11111111-1111-4111-a111-111111111111",
      address: "Apartment 706, Salford, Greater Manchester, M3 7GX",
      city: "Manchester",
      postcode: "M3 7GX",
      monthly_rent: 12000,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      address: "Apartment 706, Salford, Greater Manchester, M3 7GX",
      city: "Salford",
      postcode: "M3 7GX",
      monthly_rent: 1200,
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      address: "Other Street",
      city: "Leeds",
      postcode: "LS1 1AA",
      monthly_rent: 800,
    },
  ];

  it("matches by UUID string", () => {
    const id = "11111111-1111-4111-a111-111111111111";
    const r = rankPropertySearch(id, rows, 10);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].id).toBe(id);
    expect(r.hint).toContain("UUID");
  });

  it("ranks apartment 706 + salford", () => {
    const r = rankPropertySearch("apartment 706 salford", rows, 10);
    expect(r.candidates.length).toBeGreaterThanOrEqual(2);
    expect(r.candidates[0].address).toContain("706");
    expect(r.hint).toBeTruthy();
  });

  it("returns empty for nonsense query tokens", () => {
    const r = rankPropertySearch("zzzzzz", rows, 10);
    expect(r.candidates).toHaveLength(0);
    expect(r.hint).toBeTruthy();
  });
});
