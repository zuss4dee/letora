import { describe, expect, it } from "vitest";

import { parseWelcomeApprovalTenancyId } from "./execute-welcome-after-approval";

describe("parseWelcomeApprovalTenancyId", () => {
  it("prefers payload tenancyId when both are set", () => {
    expect(parseWelcomeApprovalTenancyId({ tenancyId: " from-payload " }, "from-target")).toBe("from-payload");
  });

  it("falls back to target_id when payload omits tenancyId", () => {
    expect(parseWelcomeApprovalTenancyId({}, "target-uuid")).toBe("target-uuid");
  });

  it("returns null when neither is usable", () => {
    expect(parseWelcomeApprovalTenancyId({}, null)).toBeNull();
    expect(parseWelcomeApprovalTenancyId({ tenancyId: "" }, null)).toBeNull();
  });
});
