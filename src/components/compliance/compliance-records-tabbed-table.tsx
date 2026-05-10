"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";

import type { ComplianceType } from "@/lib/compliance/types";
import { cn } from "@/lib/utils";

export type ComplianceRecordTabRow = {
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

export type ComplianceRecordsTab = "all" | "missing" | "expiring" | "compliant";

const TABS: { id: ComplianceRecordsTab; label: string }[] = [
  { id: "all", label: "All Records" },
  { id: "missing", label: "Missing" },
  { id: "expiring", label: "Expiring Soon" },
  { id: "compliant", label: "Compliant" },
];

function filterRowsByTab(rows: ComplianceRecordTabRow[], tab: ComplianceRecordsTab): ComplianceRecordTabRow[] {
  if (tab === "all") return rows;
  if (tab === "missing") return rows.filter((r) => r.status === "missing");
  if (tab === "expiring") return rows.filter((r) => r.status === "expiring");
  return rows.filter((r) => r.status === "valid");
}

function statusPill(status: ComplianceRecordTabRow["status"]) {
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

function riskMark(risk: ComplianceRecordTabRow["risk"]) {
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

type ComplianceRecordsTabbedTableProps = {
  rows: ComplianceRecordTabRow[];
  /** Highlights the row and supports keyboard activation when set. */
  selectedRowId?: string | null;
  onRowClick?: (row: ComplianceRecordTabRow) => void;
};

export function ComplianceRecordsTabbedTable({
  rows,
  selectedRowId = null,
  onRowClick,
}: ComplianceRecordsTabbedTableProps) {
  const [tab, setTab] = useState<ComplianceRecordsTab>("all");

  const filteredRows = useMemo(() => filterRowsByTab(rows, tab), [rows, tab]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex border-b border-zinc-800 bg-background dark:bg-[#131313] px-4" role="tablist" aria-label="Filter compliance records">
        {TABS.map(({ id, label }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`compliance-tab-${id}`}
              aria-controls="compliance-records-panel"
              onClick={() => setTab(id)}
              className={cn(
                "border-b-2 px-4 py-3 text-[11px] uppercase tracking-widest transition-colors",
                selected
                  ? "border-white font-bold text-zinc-900 dark:text-white"
                  : "border-transparent font-semibold text-zinc-500 hover:text-zinc-300",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto bg-background dark:bg-[#131313]"
        role="tabpanel"
        id="compliance-records-panel"
        aria-labelledby={`compliance-tab-${tab}`}
      >
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-background dark:bg-[#161616]">
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
            {filteredRows.map((row) => {
              const interactive = typeof onRowClick === "function";
              const selected = selectedRowId === row.id;
              return (
              <tr
                key={row.id}
                tabIndex={interactive ? 0 : undefined}
                aria-label={
                  interactive
                    ? `Upload or replace certificate: ${row.type} — ${row.property}`
                    : undefined
                }
                onClick={interactive ? () => onRowClick(row) : undefined}
                onKeyDown={
                  interactive
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "group transition-colors",
                  interactive && "cursor-pointer hover:bg-zinc-100 dark:bg-zinc-900 focus-visible:bg-zinc-100 dark:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                  selected && "border-l-2 border-white bg-zinc-200 dark:bg-zinc-800/40",
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-tight text-zinc-900 dark:text-white">{row.property}</span>
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
                  <ChevronRight
                    className={cn(
                      "ml-auto h-4 w-4 text-zinc-600 transition-colors",
                      interactive && "group-hover:text-zinc-900 dark:hover:text-zinc-900 dark:text-white",
                    )}
                    aria-hidden
                  />
                </td>
              </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No compliance records yet.
                </td>
              </tr>
            ) : null}
            {rows.length > 0 && filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No records in this category.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
