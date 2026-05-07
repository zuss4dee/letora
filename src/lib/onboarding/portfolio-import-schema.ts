/**
 * Portfolio import — supported CSV schema and documented rules.
 * Kept alongside parsing in `tenant-import.ts` for a single operational contract.
 */

export type PortfolioImportRowKind = "occupied" | "vacant" | "onboarding";

/** Canonical CSV column names (aliases exist in parser; see tenant-import header map). */
export const PORTFOLIO_IMPORT_COLUMNS = {
  /** Required unless entire file uses alternate minimum set (legacy mode). See docs. */
  propertyAddress: "property_address",
  city: "city",
  postcode: "postcode",
  propertyName: "property_name",
  propertyType: "property_type",
  bedrooms: "bedrooms",
  bathrooms: "bathrooms",
  rowKind: "row_kind",
  tenantName: "tenant_name",
  tenantEmail: "tenant_email",
  tenantPhone: "tenant_phone",
  monthlyRent: "monthly_rent",
  rentDueDay: "rent_due_day",
  startDate: "start_date",
  moveInDate: "move_in_date",
  endDate: "end_date",
  depositAmount: "deposit_amount",
  tenancyStatus: "tenancy_status",
  /** `clear` | `arrears` — affects first seeded rent instalment only. */
  rentPosition: "rent_position",
  notes: "notes",
} as const;

/**
 * Explicit required vs optional by row kind.
 * - Occupied / onboarding (tenant workflow): property + tenancy + tenant identity + rent + start.
 * - Vacant (property-only): street address only; postcode/city strongly recommended as warnings only.
 */
export const PORTFOLIO_IMPORT_SCHEMA = {
  requiredWhenOccupied: [
    `${PORTFOLIO_IMPORT_COLUMNS.propertyAddress} (or alias: property, address)`,
    `${PORTFOLIO_IMPORT_COLUMNS.tenantName} (or tenant, name)`,
    `${PORTFOLIO_IMPORT_COLUMNS.tenantEmail}`,
    `${PORTFOLIO_IMPORT_COLUMNS.monthlyRent}`,
    `${PORTFOLIO_IMPORT_COLUMNS.startDate}`,
  ],
  requiredWhenOnboarding: [
    // Same required fields as occupied; only `row_kind` decides whether the onboarding agent runs.
    ...[
      `${PORTFOLIO_IMPORT_COLUMNS.propertyAddress} (or alias)`,
      `${PORTFOLIO_IMPORT_COLUMNS.tenantName}`,
      `${PORTFOLIO_IMPORT_COLUMNS.tenantEmail}`,
      `${PORTFOLIO_IMPORT_COLUMNS.monthlyRent}`,
      `${PORTFOLIO_IMPORT_COLUMNS.startDate}`,
    ],
  ],
  requiredWhenVacant: [
    `${PORTFOLIO_IMPORT_COLUMNS.propertyAddress} (or alias: property, address)`,
  ],
  optionalColumns: [
    PORTFOLIO_IMPORT_COLUMNS.city,
    PORTFOLIO_IMPORT_COLUMNS.postcode,
    PORTFOLIO_IMPORT_COLUMNS.propertyName,
    PORTFOLIO_IMPORT_COLUMNS.propertyType,
    PORTFOLIO_IMPORT_COLUMNS.bedrooms,
    PORTFOLIO_IMPORT_COLUMNS.bathrooms,
    PORTFOLIO_IMPORT_COLUMNS.rowKind,
    PORTFOLIO_IMPORT_COLUMNS.tenantPhone,
    PORTFOLIO_IMPORT_COLUMNS.rentDueDay,
    PORTFOLIO_IMPORT_COLUMNS.moveInDate,
    PORTFOLIO_IMPORT_COLUMNS.endDate,
    PORTFOLIO_IMPORT_COLUMNS.depositAmount,
    PORTFOLIO_IMPORT_COLUMNS.tenancyStatus,
    PORTFOLIO_IMPORT_COLUMNS.rentPosition,
    PORTFOLIO_IMPORT_COLUMNS.notes,
  ],
  rowKindValues: [`occupied`, `vacant`, `onboarding`] as const,
  rentPositionValues: [`clear`, `arrears`] as const,
  legacyMinimumHeaders: [
    "property_address (or alias)",
    "tenant_name (or tenant, name)",
    "tenant_email (or email)",
    "monthly_rent",
    "start_date",
  ],
  headerRequirement:
    'If column "row_kind" (or occupancy / import_type) exists, vacant rows omit tenant columns. Otherwise legacy mode requires tenant, email, rent, and start columns for every row.',
} as const;

/** Sidebar / docs: human-readable supported import contract. */
export const PORTFOLIO_IMPORT_SCHEMA_GUIDE = `
Required columns — always:
• property_address (aliases: property, address, property line)

With row_kind (recommended): occupied | vacant | onboarding (aliases: row_kind, import_type, occupancy)
• vacant → property-only; no tenant or tenancy rows.
• occupied → active live tenancy + tenant; onboarding is marked complete — no welcome/onboarding agent (use for already-moved-in renters).
• onboarding → pending / pre-move-in tenancy; onboarding agent runs after import (welcome path) unless tenancy is ended.

Legacy (no row_kind): rows are treated as occupied (same as live import).

Dates: prefer YYYY-MM-DD; DD/MM/YYYY accepted (UK day-first).
Rent: numeric or £1,200 pcm-style; vacant allows 0.
Postcodes: validated as UK outward+inward when present; omit for warning only — not an error unless format invalid.
Duplicates: identical property+tenant rows in one file skip later rows; sheet order defines the survivor.
Tenancy_status: lifecycle (active/pending/ended, etc.). Arrears/late/overdue belongs in tenancy_status OR rent_position — both map arrears onto the rent tracker without changing tenancy to “ended”.
Rent_position: clear | arrears — seeds first instalment timing/status (use with occupied live tenancies).
`.trim();

export function normalizeUkPostcodeSpaces(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toUpperCase();
}

export function isLikelyUkPostcode(raw: string | null | undefined): boolean {
  const compact = normalizeUkPostcodeSpaces(raw ?? "").replace(/\s+/g, "");
  if (!compact) return false;
  if (/^GIR0AA$/i.test(compact)) return true;
  return /^[A-Z]{1,2}\d[A-Z0-9]?\d[A-Z]{2}$/i.test(compact);
}

/** Align first rent due date to calendar day (clamp + roll to next month if before start). */
export function computeInitialRentDueDate(tenancyStartIso: string, rentDueDay: number | null): string {
  const start = new Date(`${tenancyStartIso}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return tenancyStartIso;
  if (rentDueDay == null || Number.isNaN(rentDueDay) || rentDueDay < 1 || rentDueDay > 31) {
    return tenancyStartIso;
  }
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(rentDueDay, lastDay);
  let due = new Date(Date.UTC(y, m, day));
  if (due.getTime() < start.getTime()) {
    const nm = m + 1;
    const ny = nm > 11 ? y + 1 : y;
    const mm = nm > 11 ? 0 : nm;
    const last2 = new Date(Date.UTC(ny, mm + 1, 0)).getUTCDate();
    const day2 = Math.min(rentDueDay, last2);
    due = new Date(Date.UTC(ny, mm, day2));
  }
  return due.toISOString().slice(0, 10);
}

/** Past due date for arrears demo rows (45 days before tenancy start). */
export function arrearsDemoDueDate(startDateIso: string): string {
  const d = new Date(`${startDateIso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return startDateIso;
  d.setUTCDate(d.getUTCDate() - 45);
  return d.toISOString().slice(0, 10);
}
