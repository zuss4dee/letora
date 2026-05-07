import { describe, expect, it } from "vitest";

import {
  buildBatchReviewReturnHref,
  parseSafeBatchReviewReturn,
  reviewRowDomId,
  withReturnToQuery,
} from "@/lib/navigation/batch-review-return";

describe("batch review return routing", () => {
  it("builds path and review row hash", () => {
    expect(reviewRowDomId(4)).toBe("review-row-4");
    expect(buildBatchReviewReturnHref("3b0d9615-5d0b-44e9-b030-1f25819aecfc", 4)).toBe(
      "/dashboard/import/batch/3b0d9615-5d0b-44e9-b030-1f25819aecfc#review-row-4",
    );
  });

  it("withReturnToQuery appends encoded returnTo", () => {
    expect(
      withReturnToQuery(
        "/dashboard/tenants/a",
        "/dashboard/import/batch/b#review-row-1",
      ).startsWith("/dashboard/tenants/a?returnTo="),
    ).toBe(true);
  });

  it("parses allowed relative targets only", () => {
    expect(parseSafeBatchReviewReturn("/dashboard/import/batch/ab-c#review-row-12")).toBe(
      "/dashboard/import/batch/ab-c#review-row-12",
    );
    expect(
      parseSafeBatchReviewReturn(encodeURIComponent("/dashboard/import/batch/x#review-row-3")),
    ).toBe("/dashboard/import/batch/x#review-row-3");

    expect(parseSafeBatchReviewReturn("https://evil.com")).toBeNull();
    expect(parseSafeBatchReviewReturn("/dashboard/other")).toBeNull();
    expect(parseSafeBatchReviewReturn("/dashboard/import/batch/x#evil")).toBeNull();
    expect(parseSafeBatchReviewReturn("/dashboard/import/batch/x/../y")).toBeNull();
    expect(parseSafeBatchReviewReturn(null)).toBeNull();
  });
});
