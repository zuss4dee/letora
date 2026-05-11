import { describe, expect, it } from "vitest";

import { checkChatRateLimit } from "./chat-rate-limit";

describe("checkChatRateLimit", () => {
  it("allows up to the per-window cap then rejects", () => {
    const uid = `test-user-${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < 60; i++) {
      expect(checkChatRateLimit(uid)).toEqual({ ok: true });
    }
    const blocked = checkChatRateLimit(uid);
    expect(blocked.ok).toBe(false);
    if (blocked.ok === false) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });
});
