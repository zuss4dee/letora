import { Suspense } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, Upload } from "lucide-react";

import { getComplianceRecordsForUser } from "@/lib/actions/compliance";
import { getProperties } from "@/lib/actions/properties";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ComplianceUiRow = {
  id: string;
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

function statusPill(status: ComplianceUiRow["status"]) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]",
        status === "expired" && "border-red-500/20 bg-red-500/10 text-red-500",
        status === "missing" && "border-red-500/20 bg-red-500/10 text-red-500",
        status === "expiring" && "border-amber-500/20 bg-amber-500/10 text-amber-500",
        status === "valid" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
      )}
    >
      <span
        className={cn(
          "h-1 w-1 rounded-full",
          status === "expired" && "bg-red-500",
          status === "missing" && "bg-red-500",
          status === "expiring" && "bg-amber-500",
          status === "valid" && "bg-emerald-500",
        )}
        aria-hidden
      />
      {status}
    </span>
  );
}

function riskMark(risk: ComplianceUiRow["risk"]) {
  if (risk === "high") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.02em] text-red-500">
        <AlertTriangle className="h-3.5 w-3.5" /> High Risk
      </span>
    );
  }
  if (risk === "medium") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.02em] text-amber-500">
        <Clock3 className="h-3.5 w-3.5" /> Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.02em] text-zinc-500">
      <CheckCircle2 className="h-3.5 w-3.5" /> Low Risk
    </span>
  );
}

async function ComplianceDataSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const [properties, records] = userId
    ? await Promise.all([getProperties(userId), getComplianceRecordsForUser(userId)])
    : [[], []];

  const rows: ComplianceUiRow[] = [];
  for (const p of properties) {
    for (const type of CERT_TYPES) {
      if (type === "Gas Safety" && !p.hasGasSupply) continue;
      const rec = records.find((r) => r.propertyId === p.id && r.type === type);
      const status = rec?.status ?? "missing";
      rows.push({
        id: `${p.id}-${type}`,
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

  return (
    <>
      <div className="grid grid-cols-4 border-b border-zinc-800 bg-[#0B0B0B]">
        <div className="border-r border-zinc-800 p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Missing Certificates</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold leading-none text-red-500">{missingCount}</span>
            <AlertTriangle className="mb-1 h-4 w-4 text-red-500/60" />
          </div>
        </div>
        <div className="border-r border-zinc-800 p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Expiring Soon</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold leading-none text-amber-500">{expiringCount}</span>
            <Clock3 className="mb-1 h-4 w-4 text-amber-500/60" />
          </div>
        </div>
        <div className="border-r border-zinc-800 p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Total Compliance</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold leading-none text-white">{compliancePct}%</span>
            <span className="mb-1 text-[10px] font-bold text-emerald-500">+0.4%</span>
          </div>
        </div>
        <div className="flex items-center justify-center p-4">
          <button className="inline-flex items-center gap-2 bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-950 transition-colors hover:bg-zinc-200">
            <Upload className="h-3.5 w-3.5" />
            Upload Certificate
          </button>
        </div>
      </div>

      <div className="flex border-b border-zinc-800 bg-[#131313] px-4">
        <button className="border-b-2 border-white px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-white">All Records</button>
        <button className="border-b-2 border-transparent px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">Missing</button>
        <button className="border-b-2 border-transparent px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">Expiring Soon</button>
        <button className="border-b-2 border-transparent px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">Compliant</button>
      </div>

      <div className="flex-1 overflow-auto bg-[#131313]">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#161616]">
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Property</th>
              <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Type</th>
              <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
              <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Expiry State</th>
              <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Risk Level</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {sortedRows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  "group transition-colors hover:bg-zinc-900",
                  idx === 0 && "border-l-2 border-white bg-zinc-800/40",
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-tight text-white">{row.property}</span>
                    <span className="text-[10px] text-zinc-500">{row.propertySub}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-zinc-300">{row.type}</td>
                <td className="px-4 py-3">{statusPill(row.status)}</td>
                <td
                  className={cn(
                    "px-4 py-3 text-[11px]",
                    row.status === "expired" || row.status === "missing"
                      ? "font-medium italic text-red-400"
                      : "text-zinc-400",
                  )}
                >
                  {row.expiryText}
                </td>
                <td className="px-4 py-3">{riskMark(row.risk)}</td>
                <td className="px-4 py-3 text-right">
                  <ChevronRight className="ml-auto h-4 w-4 text-zinc-600 transition-colors group-hover:text-white" />
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No compliance records yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ComplianceFallback() {
  return (
    <>
      <div className="grid grid-cols-4 border-b border-zinc-800 bg-[#0B0B0B]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[88px] animate-pulse border-r border-zinc-800 bg-[#111]" />
        ))}
      </div>
      <div className="flex border-b border-zinc-800 bg-[#131313] px-4 py-3">
        <div className="h-4 w-52 animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="flex-1 space-y-2 overflow-auto bg-[#131313] p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-[2px] bg-zinc-800/70" />
        ))}
      </div>
    </>
  );
}

export default function CompliancePage() {
  return (
    <div className="@container/main flex min-h-[calc(100vh-2.5rem)] flex-1 flex-col">
      <section className="flex min-h-0 flex-1 flex-col bg-[#0B0B0B]">
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

        <Suspense fallback={<ComplianceFallback />}>
          <ComplianceDataSection />
        </Suspense>
      </section>
    </div>
  );
}
