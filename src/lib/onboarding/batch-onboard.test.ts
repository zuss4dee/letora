import { describe, expect, it } from "vitest";

import { prepareBatchOnboarding } from "./batch-onboard";
import {
  normalizeBatchOnboardingRow,
  parseBatchOnboardingCsvWithMeta,
  type BatchOnboardingRow,
} from "./tenant-import";

/**
 * Tiny fake supabase client that satisfies the narrow slice of the Query Builder
 * used by `prepareBatchOnboarding`. Returns configurable canned data per table.
 */
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

function rawRow(partial: Partial<BatchOnboardingRow> & {
  propertyAddress: string;
  tenantFullName: string;
  tenantEmail: string;
  monthlyRent: number;
  startDate: string;
}): BatchOnboardingRow {
  return normalizeBatchOnboardingRow({
    rowKind: partial.rowKind ?? null,
    propertyAddress: partial.propertyAddress,
    city: partial.city ?? null,
    postcode: partial.postcode ?? null,
    propertyDisplayName: partial.propertyDisplayName ?? null,
    propertyType: partial.propertyType ?? null,
    bedrooms: partial.bedrooms ?? null,
    bathrooms: partial.bathrooms ?? null,
    tenantFullName: partial.tenantFullName,
    tenantEmail: partial.tenantEmail,
    tenantPhone: partial.tenantPhone ?? null,
    monthlyRent: partial.monthlyRent,
    rentDueDay: partial.rentDueDay ?? null,
    startDate: partial.startDate,
    moveInDate: partial.moveInDate ?? null,
    endDate: partial.endDate ?? null,
    depositAmount: partial.depositAmount ?? null,
    tenancyStatus: partial.tenancyStatusDb ?? null,
    rentPosition: partial.rentPosition ?? null,
    notes: partial.notes ?? null,
  });
}

describe("prepareBatchOnboarding", () => {
  it("tags rows with matching addresses as matched_property", async () => {
    const rows: BatchOnboardingRow[] = [
      rawRow({
        propertyAddress: "12 Oak St",
        city: "London",
        tenantFullName: "Alex Stone",
        tenantEmail: "alex@example.com",
        monthlyRent: 1800,
        startDate: "2026-05-01",
      }),
    ];
    const supabase = makeFakeSupabase({
      properties: [{ id: "prop-1", address: "12 Oak St", city: "London", postcode: null }],
    });

    const prepared = await prepareBatchOnboarding(rows, "user-1", supabase as never);
    expect(prepared.rows[0].tags).toContain("matched_property");
    expect(prepared.rows[0].propertyId).toBe("prop-1");
    expect(prepared.summary.matchedProperties).toBe(1);
    expect(prepared.summary.newProperties).toBe(0);
  });

  it("tags new properties and new tenants appropriately", async () => {
    const rows: BatchOnboardingRow[] = [
      rawRow({
        propertyAddress: "99 New Rd",
        city: "Bristol",
        tenantFullName: "Fresh Face",
        tenantEmail: "fresh@example.com",
        monthlyRent: 1100,
        startDate: "2026-05-01",
      }),
    ];
    const supabase = makeFakeSupabase({});
    const prepared = await prepareBatchOnboarding(rows, "user-1", supabase as never);
    expect(prepared.rows[0].tags).toContain("new_property");
    expect(prepared.rows[0].tags).not.toContain("existing_tenant");
    expect(prepared.summary.newProperties).toBe(1);
    expect(prepared.summary.existingTenants).toBe(0);
  });

  it("flags existing active tenancy as skip (idempotency)", async () => {
    const rows: BatchOnboardingRow[] = [
      rawRow({
        propertyAddress: "12 Oak St",
        city: "London",
        tenantFullName: "Alex Stone",
        tenantEmail: "alex@example.com",
        monthlyRent: 1800,
        startDate: "2026-05-01",
      }),
    ];
    const supabase = makeFakeSupabase({
      properties: [{ id: "prop-1", address: "12 Oak St", city: "London", postcode: null }],
      tenants: [{ id: "tenant-1", email: "alex@example.com" }],
      activePairs: [{ property_id: "prop-1", tenant_id: "tenant-1" }],
    });
    const prepared = await prepareBatchOnboarding(rows, "user-1", supabase as never);
    expect(prepared.rows[0].tags).toContain("existing_active_tenancy_skip");
    expect(prepared.summary.skippedActiveTenancies).toBe(1);
    expect(prepared.summary.actionableRows).toBe(0);
  });

  it("keeps validation_error rows separate from writeable rows", async () => {
    const rows: BatchOnboardingRow[] = [
      normalizeBatchOnboardingRow({
        propertyAddress: "",
        tenantFullName: "Broken",
        tenantEmail: "broken@example.com",
        monthlyRent: 900,
        startDate: "2026-05-01",
      }),
      rawRow({
        propertyAddress: "7 Good St",
        city: "Leeds",
        tenantFullName: "All Good",
        tenantEmail: "good@example.com",
        monthlyRent: 1200,
        startDate: "2026-05-01",
      }),
    ];
    const supabase = makeFakeSupabase({});
    const prepared = await prepareBatchOnboarding(rows, "user-1", supabase as never);
    expect(prepared.summary.validationErrors).toBe(1);
    expect(prepared.summary.actionableRows).toBe(1);
    expect(prepared.rows[0].tags).toContain("validation_error");
    expect(prepared.rows[1].tags).not.toContain("validation_error");
  });

  describe("portfolio CSV vacancy inference", () => {
    it("infers vacant for property-only legacy headers when row_kind is absent", () => {
      const csv = `property_address,city,tenant_name,tenant_email,monthly_rent,start_date
1 Willow Way,London,,,,,`;
      const res = parseBatchOnboardingCsvWithMeta(csv);
      expect(res.parseLevel).toBe("ok");
      expect(res.rows.length).toBe(1);
      expect(res.rows[0]?.rowKind).toBe("vacant");
    });

    it("infers vacant when row_kind column exists but cells are empty and tenant signals are absent", () => {
      const csv = `row_kind,property_address,city,tenant_name,tenant_email,monthly_rent,start_date
,Brixton Flat,London,,,,,`;
      const res = parseBatchOnboardingCsvWithMeta(csv);
      expect(res.parseLevel).toBe("ok");
      expect(res.rows[0]?.rowKind).toBe("vacant");
    });
  });
});
