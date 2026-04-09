import type { ComplianceRecordRow } from "@/lib/actions/compliance";
import type { ComplianceType } from "@/lib/compliance/types";
import type { PropertyRow } from "@/lib/actions/properties";

const ALL_TYPES: ComplianceType[] = ["EPC", "Gas Safety", "Electric Safety"];

function typesForProperty(hasGasSupply: boolean): ComplianceType[] {
  if (hasGasSupply) return ALL_TYPES;
  return ALL_TYPES.filter((t) => t !== "Gas Safety");
}

function recordFor(
  records: ComplianceRecordRow[],
  propertyId: string,
  type: ComplianceType,
): ComplianceRecordRow | undefined {
  return records.find((r) => r.propertyId === propertyId && r.type === type);
}

/**
 * Counts certificate slots across the portfolio: expired, needs attention (missing PDF or date / gap), valid or expiring.
 */
export function computeCompliancePortfolioSummary(
  properties: PropertyRow[],
  records: ComplianceRecordRow[],
): { expired: number; missing: number; valid: number } {
  let expired = 0;
  let missing = 0;
  let valid = 0;

  for (const p of properties) {
    for (const type of typesForProperty(p.hasGasSupply)) {
      const rec = recordFor(records, p.id, type);
      const noDoc = !rec?.documentUrl?.trim();
      if (rec?.status === "expired") {
        expired++;
        continue;
      }
      if (noDoc || rec?.status === "missing" || !rec?.expiryDate?.trim()) {
        missing++;
        continue;
      }
      if (rec.status === "valid" || rec.status === "expiring") {
        valid++;
        continue;
      }
      missing++;
    }
  }

  return { expired, missing, valid };
}
