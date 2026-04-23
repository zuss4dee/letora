import { describe, expect, it } from "vitest";

import { replyLooksLikeDeferredToolPromise, shouldForceToolChoiceOnFirstTurn } from "./ceo-tool-first-turn";

describe("shouldForceToolChoiceOnFirstTurn", () => {
  it("is true when the router recommends tools and clarification is off", () => {
    expect(
      shouldForceToolChoiceOnFirstTurn({
        primaryIntent: "contracts",
        secondaryIntents: [],
        confidence: 0.5,
        recommendedTools: ["draft_contract"],
        confirmationRequired: false,
        wantsLeadQualification: false,
        wantsOnboardingByPlainName: false,
        wantsReferencingStatus: false,
        wantsContinueOnboarding: false,
        wantsBulkOnboarding: false,
        wantsCreateTenantTenancy: false,
        wantsOperationalBrief: false,
        needsClarification: false,
        clarificationQuestion: null,
      }),
    ).toBe(true);
  });

  it("is false when the generic category clarifier is active", () => {
    expect(
      shouldForceToolChoiceOnFirstTurn({
        primaryIntent: "portfolio",
        secondaryIntents: [],
        confidence: 0,
        recommendedTools: [],
        confirmationRequired: false,
        wantsLeadQualification: false,
        wantsOnboardingByPlainName: false,
        wantsReferencingStatus: false,
        wantsContinueOnboarding: false,
        wantsBulkOnboarding: false,
        wantsCreateTenantTenancy: false,
        wantsOperationalBrief: false,
        needsClarification: true,
        clarificationQuestion: "What should we focus on?",
      }),
    ).toBe(false);
  });
});

describe("replyLooksLikeDeferredToolPromise", () => {
  it("detects please wait and let me fetch", () => {
    expect(replyLooksLikeDeferredToolPromise("Please wait while I search your account.")).toBe(true);
    expect(
      replyLooksLikeDeferredToolPromise(
        "I need to look up your actual tenants and properties. Let me fetch your tenant list now.",
      ),
    ).toBe(true);
  });

  it("returns false for short or neutral text", () => {
    expect(replyLooksLikeDeferredToolPromise("ok")).toBe(false);
    expect(replyLooksLikeDeferredToolPromise("Which address did you mean?")).toBe(false);
  });
});
