"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Circle,
  CircleDollarSign,
  CircleUserRound,
  Command,
  Filter,
  Plus,
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import type { PropertyPortfolioRow } from "@/lib/actions/properties";
import { cn } from "@/lib/utils";

type RentStatus = "PAID" | "PARTIAL" | "OVERDUE";

function hashInt(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function propertyCodeFromId(id: string): string {
  const hash = hashInt(id).toString(16).toUpperCase().padStart(8, "0");
  return `PRO-${hash.slice(0, 4)}-${hash.slice(4, 6)}`;
}

function formatCurrencyGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function rentStatusForRow(row: PropertyPortfolioRow): RentStatus {
  if (row.maintenanceState === "attention") return "OVERDUE";
  if (row.occupancyPct < 90) return "PARTIAL";
  return "PAID";
}

export function ManagedPropertiesRegistry({ rows }: { rows: PropertyPortfolioRow[] }) {
  const selected = rows[0] ?? null;
  const selectedHash = selected ? hashInt(selected.id) : 0;
  const selectedUnits = selected ? Math.max(1, (selected.bedrooms ?? 2) * 12 + (selectedHash % 15)) : 0;
  const selectedTenants = selected ? Math.round((Math.max(0, selected.occupancyPct) / 100) * selectedUnits) : 0;
  const selectedOverdue =
    selected && selected.maintenanceState === "attention"
      ? formatCurrencyGBP((selected.monthlyRent ?? 0) * 0.35)
      : formatCurrencyGBP(0);
  const selectedTickets =
    selected && selected.maintenanceState === "attention" ? 1 + (selectedHash % 4) : selectedHash % 2;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#131313] font-[Inter] text-[#e5e2e1]">
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-[#161616] px-4">
          <div className="flex items-center gap-6">
            <div className="text-lg font-bold tracking-tighter text-white">LETORA</div>
            <div className="relative">
              <Command
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500"
                aria-hidden
              />
              <input
                readOnly
                value="CMD+K TO SEARCH..."
                aria-label="Command search"
                className="w-64 border border-zinc-800 bg-[#0B0B0B] py-1.5 pl-9 pr-3 font-mono text-[10px] uppercase tracking-wider text-zinc-500 outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="flex h-8 w-8 items-center justify-center hover:bg-[#242424]">
              <Bell className="size-4 text-zinc-400" aria-hidden />
            </button>
            <button type="button" className="flex h-8 w-8 items-center justify-center hover:bg-[#242424]">
              <Command className="size-4 text-zinc-400" aria-hidden />
            </button>
            <button type="button" className="flex h-8 w-8 items-center justify-center hover:bg-[#242424]">
              <CircleUserRound className="size-4 text-zinc-400" aria-hidden />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <section className="flex min-h-0 flex-1 flex-col border-r border-zinc-800">
            <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#161616] px-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-400 hover:text-white"
                >
                  <Filter className="size-3.5" aria-hidden />
                  FILTERS ({rows.length > 0 ? "2" : "0"})
                </button>
                <div className="h-4 w-px bg-zinc-800" />
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-400 hover:text-white"
                >
                  <Command className="size-3.5" aria-hidden />
                  SORT: OCCUPANCY
                </button>
              </div>
              <AddPropertyDialog
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 bg-white px-3 py-1 text-[10px] font-black uppercase text-black hover:bg-zinc-200"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    ADD PROPERTY
                  </button>
                }
              />
            </div>

            <div className="grid grid-cols-[2fr_1.5fr_1fr_1.2fr_1.2fr_1fr] border-b border-zinc-800 bg-[#1A1A1A] px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">
              <div>Property Name</div>
              <div>Location</div>
              <div className="text-center">Occupancy</div>
              <div className="text-center">Rent Status</div>
              <div className="text-center">Maintenance</div>
              <div className="text-right">Compliance</div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#131313]">
              {rows.length === 0 ? (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm font-semibold text-white">No properties yet</p>
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
                    Add your first property to populate the operations workspace
                  </p>
                </div>
              ) : (
                rows.map((row, index) => {
                  const isSelected = index === 0;
                  const occupancy = Math.max(0, Math.min(100, row.occupancyPct));
                  const rentStatus = rentStatusForRow(row);
                  const maintenanceLabel = row.maintenanceState === "attention" ? "ATTENTION" : "OPTIMAL";
                  const maintenanceColor = row.maintenanceState === "attention" ? "text-yellow-500" : "text-green-400";
                  const complianceAlert = row.maintenanceState === "attention";

                  return (
                    <Link
                      key={row.id}
                      href={`/dashboard/properties/${row.id}`}
                      className={cn(
                        "grid grid-cols-[2fr_1.5fr_1fr_1.2fr_1.2fr_1fr] border-b border-[#282828] px-4 py-2 transition-colors hover:bg-[#242424]",
                        isSelected && "bg-[#1A1A1A]",
                      )}
                    >
                      <div className="flex flex-col">
                        <span className={cn("text-[12px] font-bold", isSelected ? "text-white" : "text-zinc-300")}>
                          {row.identityTitle}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">{propertyCodeFromId(row.id)}</span>
                      </div>

                      <div className="flex items-center text-[11px] text-zinc-400">{row.identitySubline}</div>

                      <div className="flex flex-col items-center justify-center">
                        <span className="font-mono text-[11px] text-white">
                          {occupancy.toFixed(occupancy === 100 ? 0 : 1)}%
                        </span>
                        <div className="mt-1 h-1 w-12 bg-zinc-800">
                          <div
                            className={cn("h-full", occupancy >= 95 ? "bg-white" : "bg-zinc-400")}
                            style={{ width: `${occupancy}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[9px] font-bold uppercase",
                            rentStatus === "PAID" && "border border-zinc-700 bg-[#1B1C1C] text-[#b5b5b5]",
                            rentStatus === "PARTIAL" && "border border-zinc-700 bg-[#464747] text-zinc-300",
                            rentStatus === "OVERDUE" && "border border-[#93000a] bg-[#310002] text-[#ffb4ab]",
                          )}
                        >
                          {rentStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-center">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase", maintenanceColor)}>
                          <Circle className={cn("size-2 fill-current", maintenanceColor)} strokeWidth={0} aria-hidden />
                          {maintenanceLabel}
                        </span>
                      </div>

                      <div className="flex items-center justify-end">
                        {complianceAlert ? (
                          <ShieldAlert className="size-4 text-red-500" aria-hidden />
                        ) : (
                          <UserCheck className="size-4 text-green-500" aria-hidden />
                        )}
                      </div>
                    </Link>
                  );
                })
              )}

              {rows.length > 0 ? (
                <div className="grid grid-cols-[2fr_1.5fr_1fr_1.2fr_1.2fr_1fr] border-b border-[#282828] px-4 py-3 opacity-30">
                  <div className="h-2 w-24 bg-zinc-800" />
                  <div className="h-2 w-32 bg-zinc-800" />
                  <div className="mx-auto h-2 w-12 bg-zinc-800" />
                  <div className="mx-auto h-2 w-16 bg-zinc-800" />
                  <div className="mx-auto h-2 w-20 bg-zinc-800" />
                  <div className="ml-auto h-2 w-8 bg-zinc-800" />
                </div>
              ) : null}
            </div>
          </section>

          <aside className="hidden w-80 flex-col overflow-y-auto bg-[#161616] xl:flex">
            <div className="border-b border-zinc-800 p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="bg-zinc-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                  PROPERTY PROFILE
                </span>
                <button type="button" className="text-zinc-500 hover:text-zinc-300" aria-label="Close profile panel">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <h2 className="text-[32px] font-bold leading-tight text-white">{selected?.identityTitle ?? "—"}</h2>
              <p className="mt-1 text-[11px] uppercase tracking-tight text-zinc-500">
                {selected?.identitySubline ?? "No property selected"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-px bg-zinc-800 p-4">
              <div className="bg-[#1A1A1A] p-3">
                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">TENANTS</p>
                <p className="text-lg font-bold text-white">
                  {selectedTenants} <span className="text-[9px] text-zinc-600">/ {selectedUnits} UNITS</span>
                </p>
              </div>
              <div className="bg-[#1A1A1A] p-3">
                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">OCCUPANCY</p>
                <p className="text-lg font-bold text-green-400">
                  {selected ? `${selected.occupancyPct.toFixed(selected.occupancyPct === 100 ? 0 : 1)}%` : "—"}
                </p>
              </div>
              <div className="bg-[#1A1A1A] p-3">
                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">RENT OVERDUE</p>
                <p className="text-lg font-bold text-zinc-200">{selectedOverdue}</p>
              </div>
              <div className="bg-[#1A1A1A] p-3">
                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">OPEN TICKETS</p>
                <p className="text-lg font-bold text-white">{selectedTickets}</p>
              </div>
            </div>

            <div className="m-4 flex items-center justify-between border border-zinc-800 bg-[#0B0B0B] p-3">
              <div className="flex items-center gap-3">
                <Shield className="size-4 text-green-500" aria-hidden />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-tight text-white">COMPLIANCE STATUS</p>
                  <p className="text-[9px] text-zinc-500">EXPIRES: 12 OCT 2025</p>
                </div>
              </div>
              <span
                className={cn(
                  "text-[10px] font-black uppercase",
                  selected?.maintenanceState === "attention" ? "text-yellow-500" : "text-green-500",
                )}
              >
                {selected?.maintenanceState === "attention" ? "ATTENTION" : "ACTIVE"}
              </span>
            </div>

            <div className="flex-1 border-t border-zinc-800 p-4">
              <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">ACTIVITY LOG_</h3>
              <div className="space-y-4 font-mono text-[10px]">
                <div className="flex gap-3">
                  <div className="h-full w-1 shrink-0 bg-white" />
                  <div className="flex flex-col gap-1">
                    <span className="text-zinc-500">14:22:04</span>
                    <span className="text-zinc-200">RENT_COLLECTED (UNIT 402B)</span>
                    <span className="font-bold text-white">$3,450.00 SETTLED</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-full w-1 shrink-0 bg-zinc-800" />
                  <div className="flex flex-col gap-1">
                    <span className="text-zinc-500">12:05:11</span>
                    <span className="text-zinc-200">MAINT_TICKET_RESOLVED (HVC-02)</span>
                    <span className="text-zinc-400">FILTERS REPLACED BY OPERATOR: J. DOE</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-full w-1 shrink-0 bg-red-500" />
                  <div className="flex flex-col gap-1">
                    <span className="text-zinc-500">09:15:33</span>
                    <span className="text-zinc-200">ACCESS_WARN (FIRE_STAIRWELL_E)</span>
                    <span className="text-red-400">UNAUTHORIZED ENTRY DETECTED</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1 border-t border-zinc-800 bg-[#0B0B0B] p-4">
              <Link
                href={selected ? `/dashboard/properties/${selected.id}` : "/dashboard/properties"}
                className="flex items-center justify-between bg-[#161616] px-3 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-[#242424] hover:text-white"
              >
                VIEW PROPERTY DETAILS
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
              <Link
                href="/dashboard/compliance"
                className="flex items-center justify-between bg-[#161616] px-3 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-[#242424] hover:text-white"
              >
                OPEN COMPLIANCE
                <Shield className="size-3.5" aria-hidden />
              </Link>
              <Link
                href="/dashboard/tenants"
                className="flex items-center justify-between bg-[#161616] px-3 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-[#242424] hover:text-white"
              >
                VIEW TENANTS
                <Users className="size-3.5" aria-hidden />
              </Link>
              <Link
                href="/dashboard/maintenance"
                className="flex items-center justify-between bg-[#161616] px-3 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-[#242424] hover:text-white"
              >
                VIEW MAINTENANCE
                <Wrench className="size-3.5" aria-hidden />
              </Link>
              <Link
                href="/dashboard/rent"
                className="flex items-center justify-between bg-[#161616] px-3 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-[#242424] hover:text-white"
              >
                VIEW RENT
                <CircleDollarSign className="size-3.5" aria-hidden />
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
