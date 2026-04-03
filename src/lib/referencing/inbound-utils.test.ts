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

  it("detects common agency / landlord phrasing for auto-advance", () => {
    expect(classifyReferencingReply("Referencing passed and completed")).toBe("positive");
    expect(classifyReferencingReply("LETORA_REF: x\nReferencing passed")).toBe("positive");
    expect(classifyReferencingReply("All references are complete")).toBe("positive");
    expect(classifyReferencingReply("All clear — proceed with tenancy")).toBe("positive");
  });

  it("stays unknown when only the ref token is repeated (no outcome words)", () => {
    const tokenOnly = "LETORA_REF: 780be386-baf2-4348-9312-ba3ae8733027\n".repeat(3);
    expect(classifyReferencingReply(tokenOnly)).toBe("unknown");
  });

  it("detects negative wording", () => {
    expect(classifyReferencingReply("We must decline this applicant")).toBe("negative");
    expect(classifyReferencingReply("Application rejected by referencing")).toBe("negative");
  });
});
