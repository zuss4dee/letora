import { describe, expect, it } from "vitest";

import {
  extractOnboardingNameFromUserText,
  inferOnboardingForFromConversation,
  mergeEnrichedOnboardingInput,
} from "./enrich-onboarding-input";

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
