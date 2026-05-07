import type { PreparedRow } from "@/lib/onboarding/batch-onboard";

/** Mirrors server `PreparePayload.summary` shape for persisted preview restores. */
export type PortfolioImportDraftSummary = {
  total: number;
  validationErrors: number;
  newProperties: number;
  matchedProperties: number;
  existingTenants: number;
  skippedActiveTenancies: number;
  duplicateCsvSkips: number;
  warningRows: number;
  actionableRows: number;
};

const STORAGE_KEY = "letora.portfolioImportDraft.v1";

export type PortfolioImportDraftV1 = {
  v: 1;
  savedAt: string;
  rows: PreparedRow[];
  summary: PortfolioImportDraftSummary;
};

export function savePortfolioImportDraft(rows: PreparedRow[], summary: PortfolioImportDraftSummary): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PortfolioImportDraftV1 = {
      v: 1,
      savedAt: new Date().toISOString(),
      rows,
      summary,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

export function loadPortfolioImportDraft(): PortfolioImportDraftV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    if (rec.v !== 1 || !Array.isArray(rec.rows) || typeof rec.summary !== "object" || rec.summary === null) {
      return null;
    }
    return parsed as PortfolioImportDraftV1;
  } catch {
    return null;
  }
}

export function clearPortfolioImportDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
