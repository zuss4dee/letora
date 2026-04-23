import { describe, expect, it } from "vitest";

import { formatRouterHintForSystem, routeCEOIntent } from "./intent-router";

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

  it("routes singular “show me my lead” to leads (was falling through to portfolio)", () => {
    const r = routeCEOIntent("show me my lead");
    expect(r.needsClarification).toBe(false);
    expect(r.primaryIntent).toBe("leads");
    expect(r.recommendedTools).toContain("get_leads_summary");
  });

  it("routes “Qualify pending leads” to qualify_leads (not get_leads_summary only)", () => {
    const r = routeCEOIntent("Qualify pending leads");
    expect(r.primaryIntent).toBe("leads");
    expect(r.recommendedTools[0]).toBe("qualify_leads");
    expect(r.recommendedTools).toContain("qualify_leads");
    expect(r.wantsLeadQualification).toBe(true);
  });

  it("sets wantsLeadQualification for singular “qualify my lead”", () => {
    const r = routeCEOIntent("qualify my lead");
    expect(r.wantsLeadQualification).toBe(true);
    expect(r.recommendedTools).toContain("qualify_leads");
  });

  it("routes start onboarding for [Name] to onboarding with onboarding_for hint", () => {
    const r = routeCEOIntent("Start onboarding for Alexis Adeosun");
    expect(r.primaryIntent).toBe("onboarding");
    expect(r.wantsOnboardingByPlainName).toBe(true);
    expect(r.recommendedTools).toContain("start_tenant_onboarding");
    const hint = formatRouterHintForSystem(r);
    expect(hint).toContain("onboarding_for");
    expect(hint).toContain("Do **not** tell the user the system only accepts UUIDs");
  });

  it("routes new tenant + tenancy requests to create_tenant_and_tenancy", () => {
    const r = routeCEOIntent("Onboard a tenant for me and create the tenancy for the new tenant");
    expect(r.primaryIntent).toBe("onboarding");
    expect(r.wantsCreateTenantTenancy).toBe(true);
    expect(r.recommendedTools[0]).toBe("create_tenant_and_tenancy");
    const hint = formatRouterHintForSystem(r);
    expect(hint).toContain("create_tenant_and_tenancy");
    expect(hint).toContain("minimum blocker");
  });

  it("routes referencing status questions to prepare_referencing (regex “references?” missed “referencing”)", () => {
    const r = routeCEOIntent("What's the referencing update for Alexis?");
    expect(r.wantsReferencingStatus).toBe(true);
    expect(r.recommendedTools[0]).toBe("prepare_referencing");
    expect(r.recommendedTools).toContain("list_tenants");
    const hint = formatRouterHintForSystem(r);
    expect(hint).toContain("prepare_referencing");
    expect(hint).toContain("recent_inbound_mail");
  });

  it("routes “continue onboarding” as read-first state inspection", () => {
    const r = routeCEOIntent("continue onboarding for Alexis");
    expect(r.wantsContinueOnboarding).toBe(true);
    expect(r.wantsOnboardingStateInspection).toBe(true);
    expect(r.recommendedTools[0]).toBe("resolve_onboarding_navigation");
    expect(r.recommendedTools).not.toContain("start_tenant_onboarding");
    const hint = formatRouterHintForSystem(r);
    expect(hint).toMatch(/read-first/i);
    expect(hint).toContain("narrow reply");
  });

  it("normalizes onbosrding typo so onboarding routing still works", () => {
    const r = routeCEOIntent("continue onbosrding for Alexis");
    expect(r.wantsContinueOnboarding).toBe(true);
    expect(r.wantsOnboardingByPlainName).toBe(true);
    expect(r.wantsOnboardingStateInspection).toBe(true);
  });

  it("routes onboarding next-action question to read-first tools", () => {
    const r = routeCEOIntent("What is the next onboarding action for Joseph Prince?");
    expect(r.primaryIntent).toBe("onboarding");
    expect(r.wantsOnboardingStateInspection).toBe(true);
    expect(r.wantsRentChaseLane).toBe(false);
    expect(r.recommendedTools).toEqual(["resolve_onboarding_navigation", "get_contracts", "prepare_referencing"]);
    expect(r.recommendedTools).not.toContain("create_tenant_and_tenancy");
    expect(r.recommendedTools).not.toContain("start_tenant_onboarding");
    expect(r.recommendedTools).not.toContain("send_move_in_email");
    expect(r.recommendedTools).not.toContain("chase_rent");
    expect(r.recommendedTools).not.toContain("draft_contract");
  });

  it("routes rent chase draft requests to get_rent_status + chase_rent (not contracts)", () => {
    const r = routeCEOIntent("Draft a rent chase for Sofia Martins");
    expect(r.wantsRentChaseLane).toBe(true);
    expect(r.wantsOnboardingStateInspection).toBe(false);
    expect(r.recommendedTools.slice(0, 2)).toEqual(["get_rent_status", "chase_rent"]);
    expect(r.recommendedTools).not.toContain("draft_contract");
    const hint = formatRouterHintForSystem(r);
    expect(hint).toContain("rent chase");
    expect(hint).toContain("tenancy agreement");
  });

  it("does not merge operational brief tools into rent chase lane", () => {
    const r = routeCEOIntent("Send a rent reminder for unit 2");
    expect(r.wantsRentChaseLane).toBe(true);
    expect(r.recommendedTools).not.toContain("get_dashboard_summary");
  });

  it("routes 'where is Alexis a tenant' to tenants intent with list_tenants", () => {
    const r = routeCEOIntent("where is Alexis a tenant?");
    expect(r.primaryIntent).toBe("tenants");
    expect(r.recommendedTools).toContain("list_tenants");
    expect(r.needsClarification).toBe(false);
  });

  it("routes 'which property is Alexis a tenant at' to tenants intent", () => {
    const r = routeCEOIntent("which property is Alexis a tenant at?");
    expect(r.primaryIntent).toBe("tenants");
    expect(r.recommendedTools).toContain("list_tenants");
  });

  it("routes compliance / certificate questions to compliance tools", () => {
    const r = routeCEOIntent("Any expired EPC or gas safety certificates?");
    expect(r.primaryIntent).toBe("compliance");
    expect(r.recommendedTools[0]).toBe("get_compliance_summary");
    expect(r.recommendedTools).toContain("get_dashboard_summary");
    const hint = formatRouterHintForSystem(r);
    expect(hint).toContain("get_compliance_summary");
    expect(hint).toContain("compliance_records");
  });

  it("routes “bulk import these tenants” to bulk_onboard_tenants", () => {
    const r = routeCEOIntent("bulk import these tenants from my spreadsheet");
    expect(r.wantsBulkOnboarding).toBe(true);
    expect(r.recommendedTools[0]).toBe("bulk_onboard_tenants");
    const hint = formatRouterHintForSystem(r);
    expect(hint).toContain("bulk_onboard_tenants");
    expect(hint).toContain("csv_text");
  });

  it("sets wantsOperationalBrief and injects dashboard tools for “what should I do next”", () => {
    const r = routeCEOIntent("What should I do next?");
    expect(r.wantsOperationalBrief).toBe(true);
    expect(r.recommendedTools).toContain("get_dashboard_summary");
    expect(r.recommendedTools).toContain("get_maintenance_summary");
    expect(r.recommendedTools).toContain("get_compliance_summary");
    const hint = formatRouterHintForSystem(r);
    expect(hint).toContain("operational brief");
    expect(hint).toContain("/dashboard/approvals");
  });

  it("routes pasted CSV header (property_address + tenant_name + monthly_rent) to bulk_onboard_tenants", () => {
    const csvText = [
      "property_address,tenant_name,tenant_email,monthly_rent,start_date",
      "12 Oak St,Alex,alex@example.com,1800,2026-05-01",
    ].join("\n");
    const r = routeCEOIntent(`Onboard these please:\n${csvText}`);
    expect(r.wantsBulkOnboarding).toBe(true);
    expect(r.recommendedTools).toContain("bulk_onboard_tenants");
  });

  it("routes pending approvals questions to get_pending_approvals_summary (read-only)", () => {
    for (const msg of [
      "Show me pending approvals",
      "List pending approvals",
      "What's in approvals",
      "Review approvals",
    ]) {
      const r = routeCEOIntent(msg);
      expect(r.wantsApprovalsQueueInspection).toBe(true);
      expect(r.recommendedTools).toEqual(["get_pending_approvals_summary"]);
      expect(r.confirmationRequired).toBe(false);
      const hint = formatRouterHintForSystem(r);
      expect(hint).toContain("get_pending_approvals_summary");
      expect(hint).not.toContain("Reply **yes**");
    }
  });

  it("does not treat approve/reject applicant as approvals queue inspection", () => {
    const r = routeCEOIntent("Approve the applicant for lead 123");
    expect(r.wantsApprovalsQueueInspection).toBe(false);
  });

  it("does not treat approve + approvals as queue inspection", () => {
    expect(routeCEOIntent("Approve all pending approvals").wantsApprovalsQueueInspection).toBe(false);
  });
});
