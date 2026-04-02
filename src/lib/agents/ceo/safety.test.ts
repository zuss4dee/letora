import { describe, expect, it } from "vitest";

import { classifyCEOIntent, normalizeCEOToolInput, toolsRequireUserConfirmation } from "./safety";
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

