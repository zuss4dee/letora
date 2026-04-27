import { Suspense } from "react";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

import { ComplianceRecordsWorkspace } from "@/components/compliance/compliance-records-workspace";
import { PropertyPortfolioBackLink } from "@/components/dashboard/property-portfolio-back-link";
import { getComplianceRecordsForUser } from "@/lib/actions/compliance";
import { getProperties } from "@/lib/actions/properties";
import type { ComplianceType } from "@/lib/compliance/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ComplianceUiRow = {
  id: string;
  propertyId: string;
  certificateType: ComplianceType;
  property: string;
  propertySub: string;
  type: string;
  status: "missing" | "expired" | "expiring" | "valid";
  expiryText: string;
  risk: "high" | "medium" | "low";
};

const CERT_TYPES = ["EPC", "Gas Safety", "Electric Safety"] as const;

function displayType(type: string) {
  if (type === "Gas Safety") return "GAS SAFETY (CP12)";
  if (type === "Electric Safety") return "EICR ELECTRICAL";
  return "EPC RATING";
}

function riskFromStatus(status: ComplianceUiRow["status"]): ComplianceUiRow["risk"] {
  if (status === "expired" || status === "missing") return "high";
  if (status === "expiring") return "medium";
  return "low";
}

function daysTo(dateIso: string): number | null {
  if (!dateIso) return null;
  const today = new Date();
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function expiryStateText(status: ComplianceUiRow["status"], expiryDate: string): string {
  if (status === "missing") return "Never uploaded";
  const days = daysTo(expiryDate);
  if (days == null) return "No expiry recorded";
  if (status === "expired") return `Expired ${Math.abs(days)} days ago`;
  if (status === "expiring") return `Due in ${Math.max(days, 0)} days`;
  const dt = new Date(`${expiryDate}T00:00:00.000Z`);
  return `Expires ${dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
}

async function ComplianceDataSection({ propertyId }: { propertyId?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const [properties, records] = userId
    ? await Promise.all([getProperties(userId), getComplianceRecordsForUser(userId)])
    : [[], []];

  const scopedProperties =
    propertyId == null ? properties : properties.filter((p) => p.id === propertyId);

  const rows: ComplianceUiRow[] = [];
  for (const p of scopedProperties) {
    for (const type of CERT_TYPES) {
      if (type === "Gas Safety" && !p.hasGasSupply) continue;
      const rec = records.find((r) => r.propertyId === p.id && r.type === type);
      const status = rec?.status ?? "missing";
      rows.push({
        id: `${p.id}-${type}`,
        propertyId: p.id,
        certificateType: type,
        property: p.address?.split(",")[0]?.trim() || "Unnamed Property",
        propertySub: [p.city, p.postcode].filter(Boolean).join(", ") || "UK",
        type: displayType(type),
        status,
        expiryText: expiryStateText(status, rec?.expiryDate ?? ""),
        risk: riskFromStatus(status),
      });
    }
  }
  const sortedRows = rows.sort((a, b) => {
    const order = { expired: 0, missing: 1, expiring: 2, valid: 3 } as const;
    return order[a.status] - order[b.status];
  });
  const missingCount = rows.filter((r) => r.status === "missing").length;
  const expiringCount = rows.filter((r) => r.status === "expiring").length;
  const compliantCount = rows.filter((r) => r.status === "valid").length;
  const compliancePct = rows.length > 0 ? Math.round((compliantCount / rows.length) * 100) : 0;

  const workspaceProperties = scopedProperties.map((p) => ({
    id: p.id,
    address: p.address,
    city: p.city,
    postcode: p.postcode,
    hasGasSupply: p.hasGasSupply,
  }));

  return (
    <ComplianceRecordsWorkspace
      rows={sortedRows}
      properties={workspaceProperties}
      missingCount={missingCount}
      expiringCount={expiringCount}
      compliancePct={compliancePct}
    />
  );
}

function ComplianceFallback() {
  return (
    <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="grid grid-cols-4 border-b border-zinc-800 bg-[#0B0B0B]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[88px] animate-pulse border-r border-zinc-800 bg-[#111]" />
        ))}
      </div>
      <div className="flex border-b border-zinc-800 bg-[#131313] px-4 py-3">
        <div className="h-4 w-52 animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto bg-[#131313] p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-[2px] bg-zinc-800/70" />
        ))}
      </div>
    </div>
  );
}

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.propertyId;
  const propertyId =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;

  return (
    <div className="@container/main relative flex min-h-0 flex-1 flex-col">
      <section className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col bg-[#0B0B0B]">
        <div className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 font-[family-name:var(--font-inter)]">
          <div className="relative w-full max-w-lg">
            <input
              placeholder="Search compliance records, properties, or task IDs..."
              className="h-8 w-full border border-zinc-800 bg-[#0B0B0B] px-3 text-xs text-white placeholder:text-zinc-600 focus:border-white focus:outline-none"
            />
          </div>
          <div className="ml-4 flex items-center gap-3 text-zinc-500">
            <Clock3 className="h-4 w-4" />
            <AlertTriangle className="h-4 w-4" />
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>

        {propertyId ? (
          <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-2">
            <Suspense fallback={<div className="h-4 w-44 animate-pulse rounded bg-zinc-800/80" />}>
              <PropertyPortfolioBackLink propertyId={propertyId} />
            </Suspense>
          </div>
        ) : null}

        <Suspense fallback={<ComplianceFallback />}>
          <ComplianceDataSection propertyId={propertyId} />
        </Suspense>
      </section>
    </div>
  );
}
