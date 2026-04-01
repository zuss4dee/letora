import { describe, expect, it } from "vitest";

import { classifyReferencingReply, extractReferencingTokenFromText } from "./inbound-utils";

describe("extractReferencingTokenFromText", () => {
  it("reads LETORA_REF line", () => {
    const t = "Hello\nLETORA_REF: 550e8400-e29b-41d4-a716-446655440000\n";
    expect(extractReferencingTokenFromText(t)).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});

describe("classifyReferencingReply", () => {
  it("detects positive wording", () => {
    expect(classifyReferencingReply("Referencing is complete and passed")).toBe("positive");
  });
  it("detects negative wording", () => {
    expect(classifyReferencingReply("We must decline this applicant")).toBe("negative");
    expect(classifyReferencingReply("Application rejected by referencing")).toBe("negative");
  });
});
