import type { BatchImportDetailRow } from "@/lib/actions/batch-onboarding";

import type { ReviewPriority } from "@/lib/onboarding/batch-import-review-priority";

/** Human-readable one-line explanation of why the row surfaced in Attention. */
export function primaryAttentionReason(r: BatchImportDetailRow): string {
  const parts = [
    ...r.previewErrors,
    ...r.previewWarnings,
    ...r.prepareWarnings,
    r.runtimeError,
    r.skipReason,
    ...(r.tags ?? []),
  ].filter((x): x is string => typeof x === "string" && x.trim().length > 0);

  const s = parts.map((x) => x.trim()).join(" · ");
  if (s.length > 0) return s;

  const email = r.emailStatus?.trim();
  if (email && email.length > 0) return `Email status: ${email}`;

  return "Flagged in import — expand for full detail.";
}

export function recordDashboardLinks(r: BatchImportDetailRow): {
  tenancy: string | null;
  tenant: string | null;
  property: string | null;
} {
  return {
    tenancy: r.tenancyId ? `/dashboard/tenancies/${r.tenancyId}` : null,
    tenant: r.tenantId ? `/dashboard/tenants/${r.tenantId}` : null,
    property: r.propertyId ? `/dashboard/properties/${r.propertyId}` : null,
  };
}

export function humanRecordLabel(r: BatchImportDetailRow): string {
  const addr = (r.propertyAddress || "").trim();
  const name = (r.tenantFullName || "").trim();
  const mail = (r.tenantEmail || "").trim();

  if (addr && name) return `${addr} · ${name}`;
  if (addr && mail) return `${addr} · ${mail}`;
  if (addr) return addr;
  if (name) return name;
  if (mail) return mail;
  return "Untitled row";
}

export function recommendedActionForFailure(): string {
  return "Fix this line in your file, then Import again. Nothing was saved for this row.";
}

export function recommendedActionForReview(priority: ReviewPriority): string {
  switch (priority) {
    case "fix_now":
      return "Fix via linked records, or reconcile manually if the sheet was wrong.";
    case "check_soon":
      return "Check linked records soon (rent, notices, contracts, payments).";
    case "informational":
      return "Optional: confirm the record matches your files.";
    default:
      return "Review when you can.";
  }
}
