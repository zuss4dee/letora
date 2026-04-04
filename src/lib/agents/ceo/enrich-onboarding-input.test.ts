import { describe, expect, it } from "vitest";

import {
  draftContractMergeHasResolvableArgs,
  extractOnboardingNameFromUserText,
  extractPropertyAddressHintFromText,
  inferOnboardingForFromConversation,
  inferPropertyAddressHintFromConversation,
  inferPropertyAddressHintFromUserMessagesOnly,
  inferTenantOrContractNameFromConversation,
  mergeDraftContractInput,
  mergeEnrichedOnboardingInput,
  normalizeUserTextForInference,
  scrubDraftContractTenancyIdForMerge,
  userRequestsDraftContractInMessage,
} from "./enrich-onboarding-input";

describe("normalizeUserTextForInference", () => {
  it("fixes common the-typos so routing and extraction still work", () => {
    expect(normalizeUserTextForInference("draft ghe contract now")).toBe("draft the contract now");
  });

  it("fixes contrct → contract", () => {
    expect(normalizeUserTextForInference("draft the contrct now")).toBe("draft the contract now");
  });
});

describe("extractOnboardingNameFromUserText", () => {
  it("parses start onboarding for Full Name", () => {
    expect(extractOnboardingNameFromUserText("start onboarding for Alexis Adeosun")).toBe("Alexis Adeosun");
  });

  it("strips trailing punctuation", () => {
    expect(extractOnboardingNameFromUserText("Start onboarding for Jane Smith.")).toBe("Jane Smith");
  });
});

describe("inferOnboardingForFromConversation", () => {
  it("finds name from an earlier turn when latest message is yes", () => {
    const name = inferOnboardingForFromConversation([
      { role: "user", content: "start onboarding for Alexis Adeosun" },
      { role: "assistant", content: "Reply yes to confirm." },
      { role: "user", content: "yes" },
    ]);
    expect(name).toBe("Alexis Adeosun");
  });

  it("finds name from continue onboarding phrasing", () => {
    const name = inferOnboardingForFromConversation([
      { role: "user", content: "continue onboarding for Alexis Adeosun" },
      { role: "assistant", content: "Confirm draft?" },
      { role: "user", content: "yes" },
    ]);
    expect(name).toBe("Alexis Adeosun");
  });
});

describe("extractPropertyAddressHintFromText", () => {
  it("parses it is for 101 … row", () => {
    expect(extractPropertyAddressHintFromText("yes it is for 101 billionaires row")).toMatch(/101/i);
    expect(extractPropertyAddressHintFromText("yes it is for 101 billionaires row")?.toLowerCase()).toContain(
      "billionaires",
    );
  });

  it("parses freeform address with middle dot separator", () => {
    const h = extractPropertyAddressHintFromText("101 Billionaires Row London · L1 56AA");
    expect(h?.toLowerCase()).toContain("billionaires");
  });
});

describe("inferTenantOrContractNameFromConversation", () => {
  it("extracts a lowercase given name from draft the contract for alexis", () => {
    const name = inferTenantOrContractNameFromConversation([
      { role: "user", content: "draft the contract for alexis" },
    ]);
    expect(name).toBe("alexis");
  });

  it("expands for alexis to assistant full name when first names match", () => {
    const name = inferTenantOrContractNameFromConversation([
      { role: "assistant", content: "Draft contract for Alexis Adeosun at 101 Billionaires Row." },
      { role: "user", content: "draft the contract for alexis" },
    ]);
    expect(name).toBe("Alexis Adeosun");
  });
});

describe("inferPropertyAddressHintFromUserMessagesOnly", () => {
  it("extracts freeform UK address lines with postcode", () => {
    const h = inferPropertyAddressHintFromUserMessagesOnly([
      { role: "user", content: "101 Billionaires Row London · L1 56AA" },
    ]);
    expect(h?.toLowerCase()).toContain("billionaires");
    expect(h?.toLowerCase()).toContain("london");
  });
});

describe("inferPropertyAddressHintFromConversation", () => {
  it("finds address from assistant message when user only says draft the contract", () => {
    const h = inferPropertyAddressHintFromConversation([
      { role: "user", content: "start onboarding for Alexis Adeosun" },
      {
        role: "assistant",
        content: "Onboarding at **101 Billionaires Row** — reply yes to continue.",
      },
      { role: "user", content: "draft ghe contract now?" },
    ]);
    expect(h).toMatch(/101/i);
    expect(h?.toLowerCase()).toContain("billionaires");
  });
});

describe("mergeEnrichedOnboardingInput", () => {
  it("fills onboarding_for from inference when tool args are empty", () => {
    const out = mergeEnrichedOnboardingInput({}, "Alexis Adeosun");
    expect(out.onboarding_for).toBe("Alexis Adeosun");
  });

  it("does not override existing tenancy_id", () => {
    const out = mergeEnrichedOnboardingInput(
      { tenancy_id: "8d940bd9-309d-4e53-9a86-b057e221b268" },
      "Someone Else",
    );
    expect(out.onboarding_for).toBeUndefined();
    expect(out.tenancy_id).toBe("8d940bd9-309d-4e53-9a86-b057e221b268");
  });

  it("does not override existing onboarding_for", () => {
    const out = mergeEnrichedOnboardingInput({ onboarding_for: "Pat Lee" }, "Alexis Adeosun");
    expect(out.onboarding_for).toBe("Pat Lee");
  });
});

describe("mergeDraftContractInput", () => {
  it("fills tenant_name when tenancy_id/tenant_id/tenant_name are empty", () => {
    const out = mergeDraftContractInput({}, "Alexis Adeosun", null, null, null);
    expect(out.tenant_name).toBe("Alexis Adeosun");
  });

  it("does not attach inferred property hint when tenant_name is inferred (avoids stale assistant address)", () => {
    const out = mergeDraftContractInput({}, "Alexis Adeosun", "101 Billionaires Row", null, null);
    expect(out.tenant_name).toBe("Alexis Adeosun");
    expect(out.onboarding_property_hint).toBeUndefined();
  });

  it("attaches user-only address hint when tenant_name is inferred", () => {
    const out = mergeDraftContractInput({}, "Alexis Adeosun", null, null, "101 Row London");
    expect(out.tenant_name).toBe("Alexis Adeosun");
    expect(out.onboarding_property_hint).toBe("101 Row London");
  });

  it("does not override tenancy_id", () => {
    const out = mergeDraftContractInput(
      { tenancy_id: "8d940bd9-309d-4e53-9a86-b057e221b268" },
      "Someone Else",
      null,
      null,
      null,
    );
    expect(out.tenant_name).toBeUndefined();
    expect(out.tenancy_id).toBe("8d940bd9-309d-4e53-9a86-b057e221b268");
  });

  it("injects tenancy_id from resume prefetch when mode is resume", () => {
    const raw = JSON.stringify({
      mode: "resume",
      tenancy_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
    const out = mergeDraftContractInput({}, null, null, raw, null);
    expect(out.tenancy_id).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("scrubs unverified tenancy_id when inference can resolve by name", () => {
    const out = mergeDraftContractInput(
      scrubDraftContractTenancyIdForMerge(
        { tenancy_id: "00000000-0000-0000-0000-000000000001" },
        null,
        "Alexis Adeosun",
        null,
        null,
      ),
      "Alexis Adeosun",
      null,
      null,
      null,
    );
    expect(out.tenancy_id).toBeUndefined();
    expect(out.tenant_name).toBe("Alexis Adeosun");
  });

  it("does not scrub tenancy_id when there is no alternative resolution context", () => {
    const out = mergeDraftContractInput(
      scrubDraftContractTenancyIdForMerge(
        { tenancy_id: "00000000-0000-0000-0000-000000000001" },
        null,
        null,
        null,
        null,
      ),
      null,
      null,
      null,
      null,
    );
    expect(out.tenancy_id).toBe("00000000-0000-0000-0000-000000000001");
  });
});

describe("userRequestsDraftContractInMessage", () => {
  it("matches common phrasing", () => {
    expect(userRequestsDraftContractInMessage("draft the contract")).toBe(true);
    expect(userRequestsDraftContractInMessage("Please prepare the tenancy contract")).toBe(true);
    expect(userRequestsDraftContractInMessage("write a contract for them")).toBe(true);
  });

  it("does not match unrelated draft wording", () => {
    expect(userRequestsDraftContractInMessage("draft an email to the tenant")).toBe(false);
  });
});

describe("draftContractMergeHasResolvableArgs", () => {
  it("is true when any resolver field is present", () => {
    expect(draftContractMergeHasResolvableArgs({ tenancy_id: "x" })).toBe(true);
    expect(draftContractMergeHasResolvableArgs({ tenant_name: "Jane" })).toBe(true);
    expect(draftContractMergeHasResolvableArgs({ onboarding_property_hint: "101 High St" })).toBe(true);
    expect(draftContractMergeHasResolvableArgs({})).toBe(false);
  });
});
