import { describe, expect, it } from "vitest";

import { routeCEOIntent } from "./intent-router";

describe("routeCEOIntent — tenant list phrasing", () => {
  it("does not force category picker for “list my active tenants”", () => {
    const r = routeCEOIntent("List my active tenants");
    expect(r.needsClarification).toBe(false);
    expect(r.primaryIntent).toBe("tenants");
    expect(r.recommendedTools).toContain("list_tenants");
  });

  it("handles lowercase repeat", () => {
    const r = routeCEOIntent("list my active tenants");
    expect(r.needsClarification).toBe(false);
    expect(r.primaryIntent).toBe("tenants");
  });

  it("still routes “list tenants” (adjacent words)", () => {
    const r = routeCEOIntent("list tenants");
    expect(r.needsClarification).toBe(false);
    expect(r.primaryIntent).toBe("tenants");
  });

  it("routes show me all tenants", () => {
    const r = routeCEOIntent("show me all tenants");
    expect(r.needsClarification).toBe(false);
    expect(r.primaryIntent).toBe("tenants");
  });

  it("handles common typos in tenant requests", () => {
    const r = routeCEOIntent("lsit my active tenats");
    expect(r.needsClarification).toBe(false);
    expect(r.primaryIntent).toBe("tenants");
  });

  it("routes read-only leads query without requiring mutating tool", () => {
    const r = routeCEOIntent("do i have any leads?");
    expect(r.needsClarification).toBe(false);
    expect(r.primaryIntent).toBe("leads");
    expect(r.recommendedTools).toContain("get_leads_summary");
    expect(r.recommendedTools).not.toContain("qualify_leads");
  });
});
