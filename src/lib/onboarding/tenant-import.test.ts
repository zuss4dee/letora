import { describe, expect, it } from "vitest";

import {
  normalizeBatchOnboardingRow,
  parseBatchOnboardingCsv,
} from "./tenant-import";

describe("parseBatchOnboardingCsv", () => {
  it("parses canonical headers into BatchOnboardingRow[]", () => {
    const csv = [
      "property_address,city,postcode,tenant_name,tenant_email,tenant_phone,monthly_rent,start_date,end_date,deposit_amount",
      "12 Oak St, London, E2 7AA, Alex Stone, alex@example.com, +447000111222, 1850, 2026-05-01, 2027-04-30, 1850",
    ].join("\n");
    const rows = parseBatchOnboardingCsv(csv);
    expect(rows).toHaveLength(1);
    const [r] = rows;
    expect(r.propertyAddress).toBe("12 Oak St");
    expect(r.city).toBe("London");
    expect(r.postcode).toBe("E2 7AA");
    expect(r.tenantFullName).toBe("Alex Stone");
    expect(r.tenantEmail).toBe("alex@example.com");
    expect(r.monthlyRent).toBe(1850);
    expect(r.startDate).toBe("2026-05-01");
    expect(r.endDate).toBe("2027-04-30");
    expect(r.depositAmount).toBe(1850);
    expect(r.rowErrors).toEqual([]);
  });

  it("accepts alias headers (property/rent/start/tenant/email/phone)", () => {
    const csv = [
      "property,tenant,email,phone,rent,start",
      '"48 Kingsway Ave, Manchester",Priya Patel,priya@example.com,+447000111223,1250,15/06/2026',
    ].join("\n");
    const rows = parseBatchOnboardingCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].propertyAddress).toBe("48 Kingsway Ave, Manchester");
    expect(rows[0].tenantFullName).toBe("Priya Patel");
    expect(rows[0].monthlyRent).toBe(1250);
    expect(rows[0].startDate).toBe("2026-06-15");
  });

  it("returns rowErrors (not null rows) when required fields are missing", () => {
    const csv = [
      "property_address,tenant_name,tenant_email,monthly_rent,start_date",
      ",No Address,noaddr@example.com,1200,2026-05-01",
      "10 Blank St,Bad Email Alice,not-an-email,1200,2026-05-01",
      "22 Money Lane,Free Rent,free@example.com,0,2026-05-01",
      "33 Bad Date Rd,Wrong Date,wrong@example.com,1200,not-a-date",
    ].join("\n");
    const rows = parseBatchOnboardingCsv(csv);
    expect(rows).toHaveLength(4);
    expect(rows[0].rowErrors).toContain("Property address is required");
    expect(rows[1].rowErrors).toContain("Tenant email is required");
    expect(rows[2].rowErrors.some((e) => e.includes("Monthly rent"))).toBe(true);
    expect(rows[3].rowErrors.some((e) => e.toLowerCase().includes("start date"))).toBe(true);
  });

  it("parses UK-style pound currency in rent", () => {
    const csv = [
      "property_address,tenant_name,tenant_email,monthly_rent,start_date",
      '15 Rent St, Alex Pound, alex.pound@example.com, "£1,850 pcm", 2026-05-01',
    ].join("\n");
    const rows = parseBatchOnboardingCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].monthlyRent).toBe(1850);
    expect(rows[0].rowErrors).toEqual([]);
  });

  it("auto-fills a 1-year end date when not provided", () => {
    const csv = [
      "property_address,tenant_name,tenant_email,monthly_rent,start_date",
      "10 Short St, Short Let, short@example.com, 1000, 2026-01-10",
    ].join("\n");
    const rows = parseBatchOnboardingCsv(csv);
    expect(rows[0].endDate).toBe("2027-01-10");
  });

  it("returns [] when required columns are missing", () => {
    const csv = [
      "name,email",
      "Alex,alex@example.com",
    ].join("\n");
    expect(parseBatchOnboardingCsv(csv)).toEqual([]);
  });
});

describe("normalizeBatchOnboardingRow", () => {
  it("drops phone numbers that are too short to dial", () => {
    const r = normalizeBatchOnboardingRow({
      propertyAddress: "10 Oak St",
      tenantFullName: "Alex Tester",
      tenantEmail: "alex@example.com",
      tenantPhone: "12",
      monthlyRent: 1000,
      startDate: "2026-05-01",
    });
    expect(r.tenantPhone).toBeNull();
    expect(r.rowErrors).toEqual([]);
  });
});
