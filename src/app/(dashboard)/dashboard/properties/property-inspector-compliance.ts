import type { PropertyInspectorComplianceSummary } from "./property-inspector-compliance-types";
import { createClient } from "@/lib/supabase/server";

export type { PropertyInspectorComplianceSummary };

function formatUkDate(isoYmd: string): string {
  const d = new Date(`${isoYmd}T12:00:00`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

type CertRow = { expiry_date: string | null; status: string | null };

function summarizeComplianceRows(rows: CertRow[]): PropertyInspectorComplianceSummary {
  if (rows.length === 0) {
    return {
      hasRecords: false,
      detailLine: "No compliance data",
      badgeLabel: "—",
      gridAlert: false,
    };
  }

  const norm = (s: string | null | undefined) => (s ?? "").toLowerCase();
  const hasExpired = rows.some((r) => norm(r.status) === "expired");
  const hasExpiring = rows.some((r) => norm(r.status) === "expiring");
  const hasMissing = rows.some((r) => norm(r.status) === "missing" || r.expiry_date == null);

  const minExpiryAmong = (pred: (r: CertRow) => boolean): string | null => {
    const dates = rows.filter(pred).flatMap((r) => (r.expiry_date ? [r.expiry_date] : []));
    if (dates.length === 0) return null;
    return [...dates].sort()[0] ?? null;
  };

  if (hasExpired) {
    const d = minExpiryAmong((r) => norm(r.status) === "expired");
    return {
      hasRecords: true,
      detailLine: d ? `Earliest expired: ${formatUkDate(d)}` : "At least one certificate has expired",
      badgeLabel: "Expired",
      gridAlert: true,
    };
  }

  if (hasExpiring) {
    const d = minExpiryAmong((r) => norm(r.status) === "expiring");
    return {
      hasRecords: true,
      detailLine: d ? `Next expiry: ${formatUkDate(d)}` : "Certificate expiring soon",
      badgeLabel: "Due soon",
      gridAlert: true,
    };
  }

  if (hasMissing) {
    const next = minExpiryAmong((r) => r.expiry_date != null);
    return {
      hasRecords: true,
      detailLine: next
        ? `Next expiry: ${formatUkDate(next)} · some dates not set`
        : "No expiry dates on file",
      badgeLabel: "Incomplete",
      gridAlert: false,
    };
  }

  const next = minExpiryAmong((r) => r.expiry_date != null);
  return {
    hasRecords: true,
    detailLine: next ? `Next expiry: ${formatUkDate(next)}` : "Certificates on file",
    badgeLabel: "Valid",
    gridAlert: false,
  };
}

/**
 * Loads compliance certificate rows for the properties registry inspector (server-only).
 */
export async function loadPropertyInspectorComplianceByPropertyId(
  propertyIds: string[],
): Promise<Record<string, PropertyInspectorComplianceSummary>> {
  const base = (): PropertyInspectorComplianceSummary => ({
    hasRecords: false,
    detailLine: "No compliance data",
    badgeLabel: "—",
    gridAlert: false,
  });

  const out: Record<string, PropertyInspectorComplianceSummary> = {};
  for (const id of propertyIds) out[id] = base();
  if (propertyIds.length === 0) return out;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compliance_records")
    .select("property_id, expiry_date, status")
    .in("property_id", propertyIds);

  if (error) {
    console.warn("[property-inspector-compliance]", error.message);
    return out;
  }

  const byProperty = new Map<string, CertRow[]>();
  for (const raw of data ?? []) {
    const row = raw as { property_id: string; expiry_date: string | null; status: string | null };
    const pid = row.property_id;
    if (!byProperty.has(pid)) byProperty.set(pid, []);
    byProperty.get(pid)!.push({ expiry_date: row.expiry_date, status: row.status });
  }

  for (const id of propertyIds) {
    const list = byProperty.get(id);
    out[id] = summarizeComplianceRows(list ?? []);
  }

  return out;
}
