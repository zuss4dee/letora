import { describe, expect, it } from "vitest";

import { isAssistantConversationId } from "./store";

describe("isAssistantConversationId", () => {
  it("accepts valid UUIDs", () => {
    expect(
      isAssistantConversationId("550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
  });

  it("rejects invalid strings", () => {
    expect(isAssistantConversationId("not-a-uuid")).toBe(false);
    expect(isAssistantConversationId("")).toBe(false);
  });
});
