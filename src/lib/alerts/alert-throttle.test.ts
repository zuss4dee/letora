import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCeoFailureThrottleKey,
  resetAlertThrottleForTests,
  shouldInsertSystemAlertRow,
  shouldSendAdminAlertEmail,
} from "./alert-throttle";

describe("alert-throttle", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_ALERT_EMAIL_COOLDOWN_MS", "60000");
    vi.stubEnv("ADMIN_ALERT_DB_COOLDOWN_MS", "60000");
    resetAlertThrottleForTests();
  });

  it("allows first email then blocks repeat within cooldown window", () => {
    const k = "test:email:key";
    expect(shouldSendAdminAlertEmail(k)).toBe(true);
    expect(shouldSendAdminAlertEmail(k)).toBe(false);
  });

  it("builds stable keys for CEO failure bucketing", () => {
    const { emailKey } = buildCeoFailureThrottleKey("anthropic_loop", '404 {"type":"not_found_error"}');
    expect(emailKey).toContain("model_not_found");
  });

  it("db throttle is independent from email key namespace", () => {
    const k = "db:separate";
    expect(shouldInsertSystemAlertRow(k)).toBe(true);
    expect(shouldInsertSystemAlertRow(k)).toBe(false);
  });
});
