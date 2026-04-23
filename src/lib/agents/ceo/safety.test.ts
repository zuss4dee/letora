import { describe, expect, it } from "vitest";

import {
  buildConfirmationMessage,
  classifyCEOIntent,
  normalizeCEOToolInput,
  stripNavigateActionTagsFromAssistantText,
  toolsRequireUserConfirmation,
} from "./safety";
import type { CEOToolName } from "./tools";

describe("CEO safety confirmation gating", () => {
  it("does not require confirmation for read-only tools", () => {
    const intent = classifyCEOIntent("do i have any leads?");
    const tools: CEOToolName[] = ["get_leads_summary", "list_tenants"];
    expect(toolsRequireUserConfirmation(intent, tools)).toBe(false);
  });

  it("requires confirmation for onboarding action", () => {
    const intent = classifyCEOIntent("onboard this client");
    const tools: CEOToolName[] = ["start_tenant_onboarding"];
    expect(toolsRequireUserConfirmation(intent, tools)).toBe(true);
  });

  it("requires confirmation for freeform create tenant / tenancy phrasing", () => {
    expect(classifyCEOIntent("onboard a tenant and create the tenancy for them")).toBe(
      "confirmation_required",
    );
    expect(classifyCEOIntent("create a tenant and tenancy for Jane")).toBe("confirmation_required");
    const intent = classifyCEOIntent("create a tenant and tenancy for Jane");
    expect(toolsRequireUserConfirmation(intent, ["start_tenant_onboarding"])).toBe(true);
  });

  it("strips navigate action tags from assistant text", () => {
    const raw =
      'Done.\n<action type="navigate" label="View tenancy onboarding" href="/" />\nNext: review Approvals.';
    expect(stripNavigateActionTagsFromAssistantText(raw)).not.toMatch(/<action/i);
    expect(stripNavigateActionTagsFromAssistantText(raw)).toContain("Done.");
  });

  it("requires confirmation for maintenance dispatch action", () => {
    const intent = classifyCEOIntent("dispatch contractor to fix boiler");
    const tools: CEOToolName[] = ["dispatch_maintenance_request"];
    expect(toolsRequireUserConfirmation(intent, tools)).toBe(true);
  });

  it("respects explicit draft/preview intent for listing tool", () => {
    const intent = classifyCEOIntent("draft listing copy for this property");
    const tools: CEOToolName[] = ["generate_property_listing"];
    expect(toolsRequireUserConfirmation(intent, tools)).toBe(false);
  });

  it("treats qualify + lead wording as actionable (not read_only) when list/show appears", () => {
    const intent = classifyCEOIntent("show me my leads and qualify them");
    expect(intent).toBe("draft_suggest");
  });

  it("does not require confirmation for qualify_leads alone (matches Agents UI)", () => {
    const intent = classifyCEOIntent("do i have any leads?");
    const tools: CEOToolName[] = ["qualify_leads"];
    expect(toolsRequireUserConfirmation(intent, tools)).toBe(false);
  });

  it("treats “what’s next / next step” as draft_suggest so mutating tools are not stuck behind confirmation", () => {
    expect(classifyCEOIntent("what's the next thing to do?")).toBe("draft_suggest");
    expect(classifyCEOIntent("what's the next step")).toBe("draft_suggest");
    const intent = classifyCEOIntent("what's the next thing to do?");
    expect(toolsRequireUserConfirmation(intent, ["draft_contract"])).toBe(false);
  });

  it("treats onboarding next-action questions as draft_suggest (read-first)", () => {
    const intent = classifyCEOIntent("What is the next onboarding action for Joseph Prince?");
    expect(intent).toBe("draft_suggest");
    expect(toolsRequireUserConfirmation(intent, ["resolve_onboarding_navigation"])).toBe(false);
  });

  it("classifies 'where is X a tenant' as read_only so it does not trigger draft_contract", () => {
    expect(classifyCEOIntent("where is Alexis a tenant?")).toBe("read_only");
    expect(classifyCEOIntent("where is john a tenant")).toBe("read_only");
  });

  it("classifies approvals queue inspection as read_only", () => {
    expect(classifyCEOIntent("review approvals")).toBe("read_only");
    expect(classifyCEOIntent("show me pending approvals")).toBe("read_only");
  });

  it("classifies next onboarding action questions as draft_suggest (not read_only)", () => {
    expect(classifyCEOIntent("What is the next onboarding action for Oliver Reed?")).toBe("draft_suggest");
  });

  it("does not require confirmation for get_pending_approvals_summary alone", () => {
    const intent = classifyCEOIntent("list pending approvals");
    expect(toolsRequireUserConfirmation(intent, ["get_pending_approvals_summary"])).toBe(false);
  });
});

describe("bulk_onboard_tenants safety", () => {
  it("requires confirmation (is treated as a mutating tool)", () => {
    const intent = classifyCEOIntent("onboard these tenants from the csv");
    const tools: CEOToolName[] = ["bulk_onboard_tenants"];
    expect(toolsRequireUserConfirmation(intent, tools)).toBe(true);
  });

  it("confirmation preview mentions the row count when csv has rows", () => {
    const csv = [
      "property_address,tenant_name,tenant_email,monthly_rent,start_date",
      "12 Oak St,Alex,alex@example.com,1800,2026-05-01",
      "13 Elm St,Priya,priya@example.com,1600,2026-06-01",
    ].join("\n");
    const msg = buildConfirmationMessage({
      v: 1,
      toolCalls: [{ name: "bulk_onboard_tenants", input: { csv_text: csv } }],
    });
    expect(msg).toContain("Bulk onboard 2 rows");
  });

  it("confirmation preview falls back to generic label when csv is empty", () => {
    const msg = buildConfirmationMessage({
      v: 1,
      toolCalls: [{ name: "bulk_onboard_tenants", input: { csv_text: "" } }],
    });
    expect(msg).toContain("Bulk onboard CSV rows");
  });
});

describe("normalizeCEOToolInput", () => {
  it("stringifies non-string values so downstream code can safely treat fields as strings", () => {
    const out = normalizeCEOToolInput({
      onboarding_for: "Jane Doe",
      auto_create_tenant_and_tenancy: true,
      limit: 15,
    });
    expect(out.onboarding_for).toBe("Jane Doe");
    expect(out.auto_create_tenant_and_tenancy).toBe("true");
    expect(out.limit).toBe("15");
  });
});

