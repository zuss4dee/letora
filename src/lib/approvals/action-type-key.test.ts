import { describe, expect, it } from "vitest";

import { approvalActionTypeKey, parseAgentApprovalActionType } from "@/lib/approvals/action-type-key";

describe("parseAgentApprovalActionType", () => {
  it("normalises casing and maps known types", () => {
    expect(parseAgentApprovalActionType("SEND_RENT_CHASE_EMAIL")).toBe("send_rent_chase_email");
    expect(parseAgentApprovalActionType(" send_onboarding_email ")).toBe("send_onboarding_email");
    expect(approvalActionTypeKey(" Send_Move_In_Email ")).toBe("send_move_in_email");
  });

  it("returns null for unknown or empty values", () => {
    expect(parseAgentApprovalActionType(null)).toBeNull();
    expect(parseAgentApprovalActionType("")).toBeNull();
    expect(parseAgentApprovalActionType("portfolio_import")).toBeNull();
  });
});
