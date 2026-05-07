import type { BatchImportDetailRow } from "@/lib/actions/batch-onboarding";

export function rowKindNorm(r: BatchImportDetailRow): string {
  return (r.rowKind || "").trim().toLowerCase();
}

export function isImportOutcomeSuccess(outcome: string): boolean {
  return outcome === "created" || outcome === "resumed";
}

export function isImportOutcomeFailed(outcome: string): boolean {
  return outcome === "error";
}

function hasOperationalWarnings(r: BatchImportDetailRow): boolean {
  return r.previewWarnings.length > 0 || r.prepareWarnings.length > 0;
}

function mightNeedReview(r: BatchImportDetailRow): boolean {
  if (isImportOutcomeFailed(r.outcome)) return false;
  if (r.previewErrors.length > 0) return true;
  const tagHaystack = (r.tags ?? []).join(" ").toLowerCase();
  const warnHaystack = [...r.previewWarnings, ...r.prepareWarnings].join(" ").toLowerCase();
  if (hasOperationalWarnings(r)) return true;
  if (/arrears|rent\s*tracker|mapping|right\s*to\s*rent|compliance/i.test(tagHaystack)) return true;
  if (/arrears|rent\s*tracker|mapping/i.test(warnHaystack)) return true;
  return false;
}

function normalizeAddressKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeEmailKey(s: string): string {
  return s.trim().toLowerCase();
}

export type SuspiciousFlag = {
  code: "duplicate_address" | "duplicate_email" | "possible_duplicate";
  detail: string;
  lines: number[];
};

export type BatchReconciliationModel = {
  summary: {
    /** Distinct property IDs written in successful rows */
    propertiesCreated: number;
    /** Distinct tenant IDs written in successful rows */
    tenantsCreated: number;
    /** Distinct tenancy IDs written in successful rows */
    tenanciesCreated: number;
    failedRows: number;
    /** Rows with warnings / tags suggesting follow-up (excludes failed-only rows) */
    warningsForReview: number;
  };
  /** Created/resumed rows for occupied or onboarding (excludes vacant-only successes) */
  successfulImports: BatchImportDetailRow[];
  failed: BatchImportDetailRow[];
  /** Non-failed rows that need a human glance */
  needsReview: BatchImportDetailRow[];
  vacantOrPropertyOnly: BatchImportDetailRow[];
  suspicious: SuspiciousFlag[];
  /** ID sets for deep-links (successful / touched records only) */
  filterSets: {
    propertyIds: string[];
    tenantIds: string[];
    tenancyIds: string[];
  };
};

export function deriveEntityIdSets(rows: BatchImportDetailRow[]): {
  propertyIds: Set<string>;
  tenantIds: Set<string>;
  tenancyIds: Set<string>;
} {
  const propertyIds = new Set<string>();
  const tenantIds = new Set<string>();
  const tenancyIds = new Set<string>();
  for (const r of rows) {
    if (!isImportOutcomeSuccess(r.outcome)) continue;
    if (r.propertyId) propertyIds.add(r.propertyId);
    if (r.tenantId) tenantIds.add(r.tenantId);
    if (r.tenancyId) tenancyIds.add(r.tenancyId);
  }
  return { propertyIds, tenantIds, tenancyIds };
}

function collectSuspicious(rows: BatchImportDetailRow[]): SuspiciousFlag[] {
  const flags: SuspiciousFlag[] = [];
  const byAddr = new Map<string, number[]>();
  const byEmail = new Map<string, number[]>();

  for (const r of rows) {
    const line = r.line;
    const addr = normalizeAddressKey(r.propertyAddress || "");
    if (addr.length > 4) {
      const prev = byAddr.get(addr) ?? [];
      prev.push(line);
      byAddr.set(addr, prev);
    }
    const em = normalizeEmailKey(r.tenantEmail || "");
    if (em.includes("@")) {
      const prev = byEmail.get(em) ?? [];
      prev.push(line);
      byEmail.set(em, prev);
    }
  }

  for (const [addr, lines] of byAddr) {
    if (lines.length > 1) {
      flags.push({
        code: "duplicate_address",
        detail: `Same property address appears on ${lines.length} lines (${addr.slice(0, 72)}${addr.length > 72 ? "…" : ""}).`,
        lines: [...new Set(lines)].sort((a, b) => a - b),
      });
    }
  }
  for (const [email, lines] of byEmail) {
    if (lines.length > 1) {
      flags.push({
        code: "duplicate_email",
        detail: `Same tenant email appears on ${lines.length} lines.`,
        lines: [...new Set(lines)].sort((a, b) => a - b),
      });
    }
  }

  return flags;
}

export function reconcilePortfolioBatch(rows: BatchImportDetailRow[]): BatchReconciliationModel {
  const sets = deriveEntityIdSets(rows);
  const failed = rows.filter((r) => isImportOutcomeFailed(r.outcome));
  const successRows = rows.filter((r) => isImportOutcomeSuccess(r.outcome));

  const suspicious = collectSuspicious(rows);
  const suspiciousLineSet = new Set(suspicious.flatMap((f) => f.lines));

  const rk = rowKindNorm;
  const vacantOrPropertyOnly = rows.filter((r) => {
    if (rk(r) === "vacant") return true;
    const sk = (r.skipReason ?? "").toLowerCase();
    if (sk.includes("property") && sk.includes("only")) return true;
    if (isImportOutcomeSuccess(r.outcome) && !r.tenantId && !r.tenancyId) return true;
    return false;
  });

  const successfulImports = successRows.filter((r) => rk(r) !== "vacant");

  const needsReview = rows.filter((r) => {
    if (isImportOutcomeFailed(r.outcome)) return false;
    if (mightNeedReview(r)) return true;
    if (suspiciousLineSet.has(r.line)) return true;
    return false;
  });

  const reviewLines = new Set(needsReview.map((r) => r.line));

  return {
    summary: {
      propertiesCreated: sets.propertyIds.size,
      tenantsCreated: sets.tenantIds.size,
      tenanciesCreated: sets.tenancyIds.size,
      failedRows: failed.length,
      warningsForReview: reviewLines.size,
    },
    successfulImports,
    failed,
    needsReview,
    vacantOrPropertyOnly,
    suspicious,
    filterSets: {
      propertyIds: [...sets.propertyIds],
      tenantIds: [...sets.tenantIds],
      tenancyIds: [...sets.tenancyIds],
    },
  };
}
