/**
 * Regression bundle for portfolio import → reconciliation → list scoping (no live Supabase).
 *
 * **Manual QA (one real CSV, authenticate in dev)** — exercises preview + execute + mixed outcomes:
 * 1. Rows: ≥1 occupied, ≥1 vacant/property-only, ≥1 preview warning-only, ≥1 hard validation failure.
 * 2. Preview → Confirm & import once (verify duplicate-submit message if double-click within ~12s).
 * 3. Batch result: summary KPIs; reconciliation workspace shows Imported needs review + Failed lanes with triage pills; technical details folded.
 * 4. Deep links: `/dashboard/properties?importBatch=<id>`, same for tenants & tenancies; verify scope chip + rows.
 */
import { describe, expect, it } from "vitest";

import type { BatchImportDetailRow } from "@/lib/actions/batch-onboarding";
import { scopedPortfolioRows, scopedTenancyRows, scopedTenantRows } from "@/lib/import-batch-list-scope";
import { parseImportBatchParam } from "@/lib/import-batch-query";
import { reconcilePortfolioBatch } from "@/lib/onboarding/batch-import-reconciliation";
import { classifyNeedsReviewPriority, reviewPriorityRank } from "@/lib/onboarding/batch-import-review-priority";

function row(partial: Partial<BatchImportDetailRow> & Pick<BatchImportDetailRow, "rowIndex" | "line" | "outcome">): BatchImportDetailRow {
  return {
    rowKind: "occupied",
    propertyAddress: "",
    tenantFullName: "",
    tenantEmail: "",
    tags: [],
    previewErrors: [],
    previewWarnings: [],
    prepareWarnings: [],
    skipReason: null,
    propertyId: null,
    tenantId: null,
    tenancyId: null,
    emailStatus: null,
    ...partial,
  };
}

describe("import batch regression", () => {
  it("reconciles mixed occupied, vacant, warning, failed, duplicate patterns", () => {
    const rows: BatchImportDetailRow[] = [
      row({
        rowIndex: 0,
        line: 1,
        rowKind: "occupied",
        outcome: "created",
        propertyAddress: "1 Same St",
        tenantEmail: "a@x.com",
        propertyId: "p1",
        tenantId: "t1",
        tenancyId: "y1",
      }),
      row({
        rowIndex: 1,
        line: 2,
        rowKind: "occupied",
        outcome: "created",
        propertyAddress: "1 Same St",
        tenantEmail: "b@x.com",
        propertyId: "p2",
        tenantId: "t2",
        tenancyId: "y2",
      }),
      row({
        rowIndex: 2,
        line: 3,
        rowKind: "vacant",
        outcome: "created",
        propertyAddress: "2 Vacant Rd",
        propertyId: "p3",
        previewWarnings: [],
      }),
      row({
        rowIndex: 3,
        line: 4,
        rowKind: "occupied",
        outcome: "created",
        propertyAddress: "3 Warn Ln",
        tenantId: "t4",
        tenancyId: "y4",
        previewWarnings: ["Rent tracker mapping incomplete for this row."],
      }),
      row({
        rowIndex: 4,
        line: 5,
        rowKind: "occupied",
        outcome: "error",
        propertyAddress: "4 Bad",
        previewErrors: ["Tenant full name is required"],
      }),
    ];

    const m = reconcilePortfolioBatch(rows);

    expect(m.summary.failedRows).toBe(1);
    expect(m.failed).toHaveLength(1);
    expect(m.vacantOrPropertyOnly.some((r) => r.rowKind === "vacant")).toBe(true);
    expect(m.suspicious.some((s) => s.code === "duplicate_address")).toBe(true);

    expect(m.filterSets.propertyIds.sort()).toEqual(["p1", "p2", "p3"]);
    expect(m.needsReviewQueue.length).toBeGreaterThanOrEqual(1);

    const orderOk = [...m.needsReviewQueue].every((item, idx, arr) => {
      if (idx === 0) return true;
      return reviewPriorityRank(item.priority) >= reviewPriorityRank(arr[idx - 1]!.priority);
    });
    expect(orderOk).toBe(true);

    const dupRow = m.needsReviewQueue.find((q) => q.row.line === 1 || q.row.line === 2);
    expect(dupRow?.priority).toBe("fix_now");
  });

  it("classifies review priority bands", () => {
    expect(classifyNeedsReviewPriority(row({ rowIndex: 0, line: 1, outcome: "created" }), true)).toBe("fix_now");
    expect(
      classifyNeedsReviewPriority(
        row({
          rowIndex: 1,
          line: 2,
          outcome: "created",
          previewWarnings: [],
          previewErrors: [],
          prepareWarnings: ["Arrears status could not be aligned"],
          tags: [],
        }),
        false,
      ),
    ).toBe("check_soon");
    expect(
      classifyNeedsReviewPriority(
        row({
          rowIndex: 2,
          line: 3,
          outcome: "created",
          previewWarnings: ["Minor formatting"],
          previewErrors: [],
          prepareWarnings: [],
          tags: [],
        }),
        false,
      ),
    ).toBe("informational");
  });

  it("scopes portfolio, tenant, tenancy lists from batch snapshot sets", () => {
    const scopeOk = {
      ok: true as const,
      propertyIds: new Set(["pa", "pb"]),
      tenantIds: new Set(["ta"]),
      tenancyIds: new Set(["ya", "yb"]),
    };

    const props = scopedPortfolioRows(
      [{ id: "pa" }, { id: "xx" }],
      scopeOk,
    );
    expect(props.map((r) => r.id)).toEqual(["pa"]);

    const ten = scopedTenantRows(
      [{ id: "ta" }, { id: "tb" }],
      [
        { id: "y1", propertyId: "pa", tenantId: "ta" },
        { id: "y2", propertyId: "pa", tenantId: "tb" },
      ],
      scopeOk,
      "pa",
    );
    expect(ten.map((t) => t.id)).toEqual(["ta"]);

    const tencies = scopedTenancyRows([{ id: "ya" }, { id: "zz" }], scopeOk);
    expect(tencies.map((t) => t.id)).toEqual(["ya"]);
  });

  it("parseImportBatchParam accepts UUID only", () => {
    expect(parseImportBatchParam({ importBatch: "not-a-uuid" })).toBeUndefined();
    expect(parseImportBatchParam({ importBatch: "3b0d9615-5d0b-44e9-b030-1f25819aecfc" })).toBe(
      "3b0d9615-5d0b-44e9-b030-1f25819aecfc",
    );
  });
});
