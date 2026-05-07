import { describe, expect, it } from "vitest";

import { prepareBatchOnboarding } from "./batch-onboard";
import { normalizeBatchOnboardingRow, parseBatchOnboardingCsv } from "./tenant-import";

/** Narrow fake matching `prepareBatchOnboarding` query shape. */
function makeFakeSupabase(data: {
  properties?: Array<{ id: string; address: string; city: string | null; postcode: string | null }>;
  tenants?: Array<{ id: string; email: string; full_name?: string | null }>;
  activePairs?: Array<{ property_id: string; tenant_id: string }>;
}) {
  return {
    from(table: string) {
      if (table === "properties") {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, _val: string) {
                return Promise.resolve({ data: data.properties ?? [], error: null });
              },
            };
          },
        };
      }
      if (table === "tenants") {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, _val: string) {
                return {
                  in(_col2: string, _vals: string[]) {
                    return Promise.resolve({ data: data.tenants ?? [], error: null });
                  },
                };
              },
            };
          },
        };
      }
      if (table === "tenancies") {
        return {
          select(_cols: string) {
            return {
              in(_col: string, _vals: string[]) {
                return {
                  eq(_col2: string, _val: string) {
                    const rows = (data.activePairs ?? []).map((p) => ({ ...p, status: "active" }));
                    return Promise.resolve({ data: rows, error: null });
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table in fake supabase: ${table}`);
    },
  };
}

describe("portfolio import validation matrix", () => {
  it("accepts valid occupied tenancy row without row-level errors", () => {
    const csv = [
      "property_address,city,postcode,tenant_name,tenant_email,monthly_rent,start_date",
      '"12 Oak St",London,SW1A 1AA,Jane Doe,jane@example.com,1500,2026-04-01',
    ].join("\n");
    const [r] = parseBatchOnboardingCsv(csv)!;
    expect(r.rowErrors).toEqual([]);
    expect(r.monthlyRent).toBe(1500);
    expect(r.tenancyStatusDb).toBe("active");
  });

  it("accepts vacant property row without tenant payload", () => {
    const csv = [
      "row_kind,property_address,city,postcode,monthly_rent",
      `vacant,"99 Empty Rd",Leeds,,0`,
    ].join("\n");
    const [r] = parseBatchOnboardingCsv(csv)!;
    expect(r.rowKind).toBe("vacant");
    expect(r.rowErrors).toEqual([]);
    expect(r.tenantEmail).toBe("");
  });

  it("infers vacant when row_kind column exists but the cell is empty and occupant columns are empty", () => {
    const csv = [
      "row_kind,property_address,city,postcode,monthly_rent",
      ",99 Empty Rd,Leeds,,0",
    ].join("\n");
    const [r] = parseBatchOnboardingCsv(csv)!;
    expect(r.rowKind).toBe("vacant");
    expect(r.rowErrors).toEqual([]);
  });

  it("defaults blank row_kind to occupied when tenant fields are present (legacy-compatible)", () => {
    const csv = [
      "row_kind,property_address,city,postcode,tenant_name,tenant_email,monthly_rent,start_date",
      ",12 Oak St,London,SW1A 1AA,Jane Doe,jane@example.com,1500,2026-04-01",
    ].join("\n");
    const [r] = parseBatchOnboardingCsv(csv)!;
    expect(r.rowKind).toBe("occupied");
    expect(r.rowErrors).toEqual([]);
  });

  it("marks onboarding tenancy with onboarding row kind", () => {
    const csv = [
      "row_kind,property_address,tenant_name,tenant_email,monthly_rent,start_date",
      'onboarding,"1 High St",New Move,new@example.com,900,2026-06-01',
    ].join("\n");
    const [r] = parseBatchOnboardingCsv(csv)!;
    expect(r.rowKind).toBe("onboarding");
    expect(r.rowErrors).toEqual([]);
    expect(r.rowWarnings.some((w) => w.toLowerCase().includes("onboarding agent"))).toBe(true);
  });

  it("captures arrears-related rent positioning on occupied rows", () => {
    const r = normalizeBatchOnboardingRow({
      propertyAddress: "1 Demo Rd",
      tenantFullName: "Arrears Case",
      tenantEmail: "a@example.com",
      monthlyRent: 1100,
      startDate: "2026-01-15",
      rentPosition: "arrears",
    });
    expect(r.rowErrors).toEqual([]);
    expect(r.rentPosition).toBe("arrears");
  });

  it("treats arrears in tenancy_status as active tenancy plus arrears rent state", () => {
    const r = normalizeBatchOnboardingRow({
      propertyAddress: "1 Arrears Terrace",
      tenantFullName: "Sam Tenant",
      tenantEmail: "x@example.com",
      monthlyRent: 1000,
      startDate: "2026-01-15",
      tenancyStatus: "arrears",
    });
    expect(r.rowErrors).toEqual([]);
    expect(r.tenancyStatusDb).toBe("active");
    expect(r.rentPosition).toBe("arrears");
    expect(r.rowWarnings.some((w) => w.includes("rent tracker"))).toBe(true);
  });

  it("allows missing optional fields when required columns satisfy legacy mode", () => {
    const r = normalizeBatchOnboardingRow({
      propertyAddress: "10 Quiet Lane",
      tenantFullName: "Pat Optional",
      tenantEmail: "pat@example.com",
      monthlyRent: 800,
      startDate: "2026-03-01",
      postcode: null,
      tenantPhone: null,
      rentDueDay: null,
      notes: null,
    });
    expect(r.rowErrors).toEqual([]);
    expect(r.postcode).toBeNull();
    expect(r.rowWarnings.some((w) => w.includes("Postcode is missing"))).toBe(true);
  });

  it("blocks rows that lack required occupied fields", () => {
    const r = normalizeBatchOnboardingRow({
      propertyAddress: "20 Gap St",
      tenantFullName: "",
      tenantEmail: "",
      monthlyRent: 0,
      startDate: "",
    });
    expect(r.rowErrors.length).toBeGreaterThan(0);
    expect(r.rowErrors.some((e) => e.includes("Tenant full name"))).toBe(true);
    expect(r.rowErrors.some((e) => e.includes("email"))).toBe(true);
    expect(r.rowErrors.some((e) => e.includes("Monthly rent"))).toBe(true);
    expect(r.rowErrors.some((e) => e.includes("start date"))).toBe(true);
  });

  it("rejects invalid UK postcodes", () => {
    const r = normalizeBatchOnboardingRow({
      propertyAddress: "1 Postcode Test",
      tenantFullName: "X Y",
      tenantEmail: "x@example.com",
      monthlyRent: 1000,
      startDate: "2026-01-01",
      postcode: "NOT-A-PC",
    });
    expect(r.rowErrors.some((e) => e.includes("Postcode") && e.includes("UK"))).toBe(true);
  });

  it("rejects unrecognised start date strings", () => {
    const r = normalizeBatchOnboardingRow({
      propertyAddress: "9 Date Lane",
      tenantFullName: "Bad Date",
      tenantEmail: "bd@example.com",
      monthlyRent: 1000,
      startDate: "not-a-date",
    });
    expect(r.rowErrors.some((e) => e.includes("not recognised"))).toBe(true);
  });

  it("flags duplicate vacant property rows in prepare (same address key)", async () => {
    const csv = [
      "row_kind,property_address,city,monthly_rent",
      `vacant,"Duplicate House",Manchester,0`,
      `vacant,"Duplicate House",Manchester,0`,
    ].join("\n");
    const rows = parseBatchOnboardingCsv(csv);
    expect(rows).toHaveLength(2);
    const supabase = makeFakeSupabase({});
    const prepared = await prepareBatchOnboarding(rows, "u1", supabase as never);
    expect(prepared.rows[1].tags).toContain("duplicate_csv_row_skip");
    expect(prepared.summary.duplicateCsvSkips).toBe(1);
  });

  it("flags duplicate occupied rows for same property + tenant", async () => {
    const csv = [
      "property_address,tenant_name,tenant_email,monthly_rent,start_date",
      "Same Flat 1,Sam Same,sam@example.com,1200,2026-02-01",
      "Same Flat 1,Sam Same,sam@example.com,1200,2026-02-01",
    ].join("\n");
    const rows = parseBatchOnboardingCsv(csv);
    const supabase = makeFakeSupabase({});
    const prepared = await prepareBatchOnboarding(rows, "u1", supabase as never);
    expect(prepared.rows[1].tags).toContain("duplicate_csv_row_skip");
    expect(prepared.rows[1].skipReason?.toLowerCase()).toContain("duplicate");
    expect(prepared.summary.duplicateCsvSkips).toBe(1);
  });
});
