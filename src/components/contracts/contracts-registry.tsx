"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AddContractDialog } from "@/components/contracts/add-contract-dialog";
import { cn } from "@/lib/utils";
import type { ContractListRow } from "@/lib/actions/contracts";
import type { PropertyPickListItem } from "@/lib/actions/properties";
import type { TenantPickListItem } from "@/lib/actions/tenants";

const PAGE_SIZE = 5;

type TabId = "all" | "draft" | "sent" | "pending_signature" | "signed" | "active";

const tabs: { id: TabId; label: string; badge?: boolean }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "pending_signature", label: "Pending Signature", badge: true },
  { id: "signed", label: "Signed" },
  { id: "active", label: "Active" },
];

function initials(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatCreated(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
}

function matchesTab(c: ContractListRow, tab: TabId): boolean {
  const s = (c.status ?? "draft").toLowerCase();
  if (tab === "all") return true;
  if (tab === "draft") return s === "draft";
  if (tab === "sent") return s === "sent";
  if (tab === "pending_signature") return s === "pending_signature";
  if (tab === "signed") return s === "signed";
  if (tab === "active") return s === "active";
  return false;
}

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? "draft").toLowerCase();
  if (s === "active") {
    return (
      <span className="inline-flex items-center rounded bg-[#01696f]/20 px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wide text-[#85d3da]">
        Active
      </span>
    );
  }
  if (s === "pending_signature") {
    return (
      <span className="inline-flex items-center rounded bg-[#673c29]/20 px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wide text-[#f7b8a0]">
        Pending Signature
      </span>
    );
  }
  if (s === "draft") {
    return (
      <span className="inline-flex items-center rounded border border-[#3f4949]/30 bg-[#363433] px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wide text-[#797876]">
        Draft
      </span>
    );
  }
  if (s === "sent") {
    return (
      <span className="inline-flex items-center rounded bg-[#a1f0f6]/10 px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wide text-[#a1f0f6]">
        Sent
      </span>
    );
  }
  if (s === "signed") {
    return (
      <span className="inline-flex items-center rounded bg-[#e3a78f]/10 px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wide text-[#e3a78f]">
        Signed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-[#363433] px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wide text-[#bec8c9]">
      {status ?? "—"}
    </span>
  );
}

function RowActions({ c }: { c: ContractListRow }) {
  const s = (c.status ?? "draft").toLowerCase();
  const detail = `/dashboard/contracts/${c.id}`;
  const bold =
    "font-[family-name:var(--font-inter)] text-xs font-bold text-[#cdccca] transition-colors hover:text-[#85d3da]";
  const muted =
    "font-[family-name:var(--font-inter)] text-xs font-bold text-[#797876] transition-colors hover:text-[#85d3da]";
  const primary =
    "font-[family-name:var(--font-inter)] text-xs font-bold text-[#85d3da] underline-offset-4 hover:underline";

  switch (s) {
    case "draft":
      return (
        <div className="flex justify-end gap-4">
          <Link href={detail} className={bold}>
            View
          </Link>
          <Link href={detail} className={muted}>
            Edit
          </Link>
          <Link href={detail} className={primary}>
            Send
          </Link>
        </div>
      );
    case "pending_signature":
      return (
        <div className="flex justify-end gap-4">
          <Link href={detail} className={bold}>
            View
          </Link>
          <Link href={detail} className={primary}>
            Remind
          </Link>
        </div>
      );
    case "sent":
      return (
        <div className="flex justify-end gap-4">
          <Link href={detail} className={bold}>
            View
          </Link>
          <Link href={detail} className={muted}>
            Resend
          </Link>
        </div>
      );
    case "signed":
      return (
        <div className="flex justify-end gap-4">
          <Link href={detail} className={bold}>
            Download
          </Link>
          <Link href={detail} className={primary}>
            Activate
          </Link>
        </div>
      );
    case "active":
      return (
        <div className="flex justify-end gap-4">
          <Link href={detail} className={bold}>
            View
          </Link>
          <Link href={detail} className={muted}>
            Send
          </Link>
        </div>
      );
    default:
      return (
        <div className="flex justify-end gap-4">
          <Link href={detail} className={bold}>
            View
          </Link>
        </div>
      );
  }
}

function downloadCsv(rows: ContractListRow[]) {
  const header = "id,tenant,email,property,status,created_at";
  const lines = rows.map((c) =>
    [
      c.id,
      `"${(c.tenantName ?? "").replace(/"/g, '""')}"`,
      `"${(c.tenantEmail ?? "").replace(/"/g, '""')}"`,
      `"${(c.propertyAddress ?? "").replace(/"/g, '""')}"`,
      c.status ?? "",
      c.createdAt ?? "",
    ].join(","),
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `letora-contracts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ContractsRegistry({
  contracts,
  properties,
  tenants,
}: {
  contracts: ContractListRow[];
  properties: PropertyPickListItem[];
  tenants: TenantPickListItem[];
}) {
  const [tab, setTab] = useState<TabId>("all");
  const [page, setPage] = useState(0);
  const [newContractOpen, setNewContractOpen] = useState(false);

  const pendingSigCount = useMemo(
    () => contracts.filter((c) => (c.status ?? "").toLowerCase() === "pending_signature").length,
    [contracts],
  );

  const filtered = useMemo(() => contracts.filter((c) => matchesTab(c, tab)), [contracts, tab]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const safePage = Math.min(page, pageCount - 1);
  const sliceStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(sliceStart, sliceStart + PAGE_SIZE);

  const tabLabel =
    tab === "all" ? "contracts" : tab === "pending_signature" ? "pending signature" : tab.replace(/_/g, " ");

  return (
    <div className="min-h-0 flex-1 bg-[#141312]">
      <div className="mx-auto max-w-7xl px-6 pb-36 pt-8 md:px-10 md:pt-16">
        <div className="mb-12 flex flex-col gap-1">
          <h1 className="font-[family-name:var(--font-inter)] text-[2.75rem] font-bold tracking-[-0.04em] text-[#cdccca]">
            Contracts
          </h1>
          <p className="font-[family-name:var(--font-inter)] text-sm tracking-tight text-[#797876]">
            Manage tenancy agreements and document workflows.
          </p>
        </div>

        <div className="mb-10 flex flex-wrap items-center gap-6 border-b border-[#3f4949]/10 md:gap-8">
          {tabs.map((t) => {
            const active = tab === t.id;
            const count =
              t.badge && t.id === "pending_signature"
                ? pendingSigCount
                : undefined;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setPage(0);
                }}
                className={cn(
                  "relative flex items-center gap-2 pb-4 font-[family-name:var(--font-inter)] text-sm font-medium transition-colors",
                  active ? "text-[#cdccca]" : "text-[#797876] hover:text-[#cdccca]",
                )}
              >
                {t.label}
                {count != null && count > 0 ? (
                  <span className="rounded-full bg-[#673c29] px-1.5 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-bold text-[#e3a78f]">
                    {count}
                  </span>
                ) : null}
                {active ? (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#01696f]" aria-hidden />
                ) : null}
              </button>
            );
          })}
          <div className="ml-auto pb-4">
            <AddContractDialog
              properties={properties}
              tenants={tenants}
              open={newContractOpen}
              onOpenChange={setNewContractOpen}
              trigger={
                <button
                  type="button"
                  disabled={properties.length === 0 || tenants.length === 0}
                  className="flex items-center gap-2 font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-wider text-[#85d3da] transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  <span className="text-lg leading-none" aria-hidden>
                    +
                  </span>
                  New contract
                </button>
              }
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#3f4949]/10 bg-[#161513]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#1d1b1a]/50">
                <th className="px-8 py-5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-widest text-[#797876]">
                  Tenant
                </th>
                <th className="px-8 py-5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-widest text-[#797876]">
                  Property
                </th>
                <th className="px-8 py-5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-widest text-[#797876]">
                  Status
                </th>
                <th className="px-8 py-5 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-widest text-[#797876]">
                  Date created
                </th>
                <th className="px-8 py-5 text-right font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-widest text-[#797876]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3f4949]/5">
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-8 py-14 text-center font-[family-name:var(--font-inter)] text-sm text-[#797876]"
                  >
                    No contracts in this view.
                  </td>
                </tr>
              ) : (
                pageRows.map((c) => (
                  <tr key={c.id} className="group transition-colors hover:bg-[#211f1e]">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#2b2a28] font-[family-name:var(--font-inter)] text-xs font-bold text-[#85d3da]">
                          {initials(c.tenantName)}
                        </div>
                        <div>
                          <p className="font-[family-name:var(--font-inter)] text-sm font-medium text-[#cdccca]">
                            {c.tenantName ?? "—"}
                          </p>
                          <p className="font-[family-name:var(--font-inter)] text-xs text-[#797876]">
                            {c.tenantEmail ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-[family-name:var(--font-inter)] text-sm text-[#cdccca]">
                        {c.propertyLine1 ?? c.propertyAddress ?? "—"}
                      </p>
                      <p className="font-[family-name:var(--font-inter)] text-xs text-[#797876]">
                        {c.propertySubline ?? "—"}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-8 py-6 font-[family-name:var(--font-inter)] text-sm text-[#797876]">
                      {formatCreated(c.createdAt)}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <RowActions c={c} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex flex-col items-stretch justify-between gap-4 px-2 sm:flex-row sm:items-center">
          <p className="font-[family-name:var(--font-inter)] text-xs text-[#797876]">
            Showing{" "}
            <span className="font-medium text-[#cdccca]">
              {filtered.length === 0 ? 0 : sliceStart + 1}-{Math.min(sliceStart + PAGE_SIZE, filtered.length)}
            </span>{" "}
            of <span className="font-medium text-[#cdccca]">{filtered.length}</span> {tabLabel} contracts
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="flex size-8 items-center justify-center rounded border border-[#3f4949]/20 text-[#797876] transition-colors hover:bg-[#211f1e] disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            {pageCount <= 5 ? (
              Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded text-xs font-bold transition-colors",
                    i === safePage
                      ? "bg-[#01696f] text-[#97e6ec]"
                      : "border border-[#3f4949]/20 text-[#797876] hover:bg-[#211f1e] hover:text-[#cdccca]",
                  )}
                >
                  {i + 1}
                </button>
              ))
            ) : (
              <span className="font-[family-name:var(--font-inter)] text-xs text-[#797876]">
                Page {safePage + 1} of {pageCount}
              </span>
            )}
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="flex size-8 items-center justify-center rounded border border-[#3f4949]/20 text-[#797876] transition-colors hover:bg-[#211f1e] disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-10 left-1/2 z-40 flex -translate-x-1/2 items-center gap-6 rounded-xl border border-[#3f4949]/20 bg-[#363433]/80 px-6 py-4 shadow-2xl backdrop-blur-xl md:gap-8">
        <div className="flex items-center gap-3 border-r border-[#3f4949]/20 pr-6">
          <div className="size-2 rounded-full bg-[#f7b8a0]" aria-hidden />
          <p className="font-[family-name:var(--font-inter)] text-xs font-medium text-[#cdccca]">
            {pendingSigCount} Pending Signature{pendingSigCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => {
              downloadCsv(contracts);
              toast.success("Exported CSV.");
            }}
            className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wider text-[#797876] transition-colors hover:text-[#cdccca]"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => toast.info("Bulk reminders will be available in a future update.")}
            className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wider text-[#797876] transition-colors hover:text-[#cdccca]"
          >
            Bulk remind
          </button>
          <button
            type="button"
            disabled={properties.length === 0 || tenants.length === 0}
            onClick={() => setNewContractOpen(true)}
            className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-wider text-[#85d3da] disabled:opacity-40"
          >
            New agreement
          </button>
        </div>
      </div>
    </div>
  );
}
