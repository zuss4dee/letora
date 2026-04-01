import { describe, expect, it } from "vitest";

import {
  LEAD_QUALIFY_EMBED_MARKER,
  parseLeadQualifyEmbed,
  shouldOfferManualLeadQualifyUi,
} from "./lead-qualify-embed";

describe("shouldOfferManualLeadQualifyUi", () => {
  it("is true for simple qualify phrasing", () => {
    expect(shouldOfferManualLeadQualifyUi("qualify my lead")).toBe(true);
    expect(shouldOfferManualLeadQualifyUi("Please qualify my leads")).toBe(true);
  });

  it("is false when bundling other actions", () => {
    expect(shouldOfferManualLeadQualifyUi("qualify my leads and chase rent")).toBe(false);
  });
});

describe("parseLeadQualifyEmbed", () => {
  it("parses intro + JSON payload", () => {
    const payload = { v: 1 as const, totals: { total: 0, new: 0, pending_qualification: 0, qualified: 0, disqualified: 0 }, leads: [] };
    const content = `Hello\n\n${LEAD_QUALIFY_EMBED_MARKER}\n${JSON.stringify(payload)}`;
    const parsed = parseLeadQualifyEmbed(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.introText).toBe("Hello");
    expect(parsed!.payload.leads).toEqual([]);
  });
});
