import type { ComplianceType } from "./types";

export const COMPLIANCE_VAULT_BUCKET = "compliance-vault";

/** File name segment inside `{property_id}/{base}.pdf` (stable, filesystem-safe). */
export function complianceTypeToFileBase(type: ComplianceType): string {
  switch (type) {
    case "EPC":
      return "EPC";
    case "Gas Safety":
      return "Gas-Safety";
    case "Electric Safety":
      return "Electric-Safety";
    default:
      return "certificate";
  }
}

export function storagePathForCompliance(propertyId: string, type: ComplianceType): string {
  return `${propertyId}/${complianceTypeToFileBase(type)}.pdf`;
}
