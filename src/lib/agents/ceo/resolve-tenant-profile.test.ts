import { describe, expect, it } from "vitest";

import { looksLikeUuid, sanitizeIlikeNameFragment } from "./resolve-tenant-profile";

describe("looksLikeUuid", () => {
  it("accepts lowercase v4-style uuids", () => {
    expect(looksLikeUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });
  it("rejects display names", () => {
    expect(looksLikeUuid("Alex Dami")).toBe(false);
  });
  it("rejects partial ids", () => {
    expect(looksLikeUuid("550e8400")).toBe(false);
  });
});

describe("sanitizeIlikeNameFragment", () => {
  it("strips LIKE wildcards from user input", () => {
    expect(sanitizeIlikeNameFragment("100% Alex")).toBe("100 Alex");
  });
});
