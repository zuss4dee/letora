"use client";

import { ChevronLeft, ChevronRight, Download, Filter, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { LeadRowActions } from "@/components/leads/lead-row-actions";
import type { LeadListRow } from "@/lib/actions/leads";
import type { PropertyPickListItem } from "@/lib/actions/properties";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type StatusTab =
  | "all"
  | "new"
  | "contacted"
  | "viewing"
  | "applied"
  | "approved"
  | "rejected";

function initials(name: string): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function splitPropertyAddress(addr: string): { line1: string; line2: string | null } {
  if (!addr?.trim() || addr === "—") return { line1: "—", line2: null };
  const i = addr.indexOf(",");
  if (i === -1) return { line1: addr.trim(), line2: null };
  return {
    line1: addr.slice(0, i).trim(),
    line2: addr.slice(i + 1).trim() || null,
  };
}

function sourcePresentation(source: string | null): { label: string; dot: string } {
  const s = (source ?? "").toLowerCase();
  if (s.includes("rightmove"))
    return { label: source ?? "Source", dot: "bg-blue-400/70" };
  if (s.includes("zoopla")) return { label: source ?? "Source", dot: "bg-violet-400/70" };
  if (s.includes("onthemarket")) return { label: source ?? "Source", dot: "bg-cyan-400/60" };
  if (s.includes("referral")) return { label: source ?? "Source", dot: "bg-zinc-500/80" };
  if (s.includes("walk")) return { label: source ?? "Source", dot: "bg-emerald-400/60" };
  if (s.includes("social")) return { label: source ?? "Source", dot: "bg-fuchsia-400/60" };
  if (s === "other" || !source?.trim())
    return { label: source?.trim() || "Direct", dot: "bg-zinc-500/60" };
  return { label: source ?? "Direct", dot: "bg-background dark:bg-[#767575]/80" };
}

function pipelinePill(status: string): { label: string; className: string } {
  const s = status.toLowerCase();
  const map: Record<string, { label: string; className: string }> = {
    new: {
      label: "NEW",
      className:
        "border border-border dark:border-[#afefdd]/25 bg-background dark:bg-[#1a2e28]/80 text-[#afefdd]",
    },
    contacted: {
      label: "CONTACTED",
      className:
        "border border-border dark:border-[#484848]/30 bg-background dark:bg-[#474646]/40 text-[#d2d0cf]",
    },
    viewing: {
      label: "VIEWING SCHEDULED",
      className:
        "border border-amber-500/25 bg-amber-500/10 text-amber-500",
    },
    applied: {
      label: "REFERENCING",
      className:
        "border border-border dark:border-[#306f60]/30 bg-background dark:bg-[#206153]/20 text-[#afefdd]",
    },
    approved: {
      label: "APPROVED",
      className:
        "border border-emerald-500/25 bg-emerald-950/30 text-emerald-300",
    },
    rejected: {
      label: "REJECTED",
      className: "border border-border dark:border-[#BB5551]/30 bg-background dark:bg-[#7f2927]/20 text-[#ee7d77]",
    },
  };
  return (
    map[s] ?? {
      label: status.replace(/_/g, " ").toUpperCase(),
      className: "border border-border dark:border-[#484848]/30 bg-background dark:bg-[#474646]/30 text-muted-foreground",
    }
  );
}

function qualificationPill(status: string): { label: string; className: string } {
  const s = status.toLowerCase();
  const map: Record<string, { label: string; className: string }> = {
    qualified: {
      label: "Vetted",
      className: "border border-border dark:border-[#2d434d] bg-background dark:bg-[#1a2a2e] text-[#38bdf8]",
    },
    disqualified: {
      label: "Disqualified",
      className: "border border-border dark:border-[#4d2d2d] bg-background dark:bg-[#2e1a1a] text-[#f87171]",
    },
    pending: {
      label: "Reviewing",
      className: "border border-border dark:border-[#4d452d] bg-background dark:bg-[#2e2a1a] text-[#eab308]",
    },
  };
  return map[s] ?? map.pending;
}

function formatDateAdded(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function computeLeadStats(leads: LeadListRow[]) {
  return {
    total: leads.length,
    newCount: leads.filter((l) => l.status === "new").length,
    qualifiedCount: leads.filter((l) => l.qualifiedStatus === "qualified").length,
    viewingCount: leads.filter((l) => l.status === "viewing").length,
  };
}

function downloadCsv(rows: LeadListRow[]) {
  const h = ["Name", "Email", "Phone", "Property", "Source", "Status", "Qualified", "Date added"];
  const lines = [h.join(",")];
  for (const l of rows) {
    lines.push(
      [
        `"${l.name.replace(/"/g, '""')}"`,
        `"${(l.email ?? "").replace(/"/g, '""')}"`,
        `"${(l.phone ?? "").replace(/"/g, '""')}"`,
        `"${l.propertyAddress.replace(/"/g, '""')}"`,
        `"${(l.source ?? "").replace(/"/g, '""')}"`,
        l.status,
        l.qualifiedStatus,
        l.createdAt ?? "",
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `letora-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "viewing", label: "Viewing" },
  { id: "applied", label: "Applied" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export function LeadsRegistry({
  leads,
  properties,
}: {
  leads: LeadListRow[];
  properties: PropertyPickListItem[];
}) {
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const stats = useMemo(() => computeLeadStats(leads), [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusTab !== "all" && l.status !== statusTab) return false;
      if (!q) return true;
      const hay = [
        l.name,
        l.email ?? "",
        l.phone ?? "",
        l.propertyAddress,
        l.source ?? "",
        l.status,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, query, statusTab]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const displayFrom = total === 0 ? 0 : start + 1;
  const displayTo = Math.min(start + PAGE_SIZE, total);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background dark:bg-[#131313] text-[#e5e2e1]">
      <header className="border-b border-border dark:border-[#282828] bg-background dark:bg-[#161616] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              LeadOps Console
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
              Lead Management
            </h1>
          </div>
          <AddLeadDialog
            properties={properties}
            trigger={
              <button
                type="button"
                className="inline-flex h-8 items-center gap-2 border border-border dark:border-[#333333] bg-background dark:bg-[#1a1a1a] px-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-200 transition-colors hover:bg-background dark:bg-[#242424]"
              >
                <Plus className="size-3.5" strokeWidth={2} aria-hidden />
                Add lead
              </button>
            }
          />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-px border-b border-border dark:border-[#282828] bg-background dark:bg-[#282828] md:grid-cols-4">
        <div className="bg-background dark:bg-[#161616] px-4 py-3 sm:px-6">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Total leads</p>
          <p className="mt-1 font-mono text-lg text-zinc-900 dark:text-zinc-100">{stats.total}</p>
        </div>
        <div className="bg-background dark:bg-[#161616] px-4 py-3 sm:px-6">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">New</p>
          <p className="mt-1 font-mono text-lg text-zinc-900 dark:text-zinc-100">{stats.newCount}</p>
        </div>
        <div className="bg-background dark:bg-[#161616] px-4 py-3 sm:px-6">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Qualified</p>
          <p className="mt-1 font-mono text-lg text-[#38bdf8]">{stats.qualifiedCount}</p>
        </div>
        <div className="bg-background dark:bg-[#161616] px-4 py-3 sm:px-6">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Viewings</p>
          <p className="mt-1 font-mono text-lg text-amber-500">{stats.viewingCount}</p>
        </div>
      </section>

      <div className="border-b border-border dark:border-[#282828] bg-background dark:bg-[#161616] px-4 py-2 sm:px-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search leads, properties, email, source..."
              className="h-8 w-full border border-border dark:border-[#333333] bg-background dark:bg-[#0b0b0b] pl-9 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-100 focus:outline-none"
              aria-label="Search leads"
            />
          </div>
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "inline-flex h-7 items-center gap-1 border border-border dark:border-[#333333] bg-background dark:bg-[#1a1a1a] px-2 text-[10px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-100",
                showFilters && "text-zinc-900 dark:text-zinc-100",
              )}
              aria-label="Toggle filters"
              aria-pressed={showFilters}
            >
              <Filter className="size-3.5" strokeWidth={1.5} />
              Filters
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(filtered)}
              className="inline-flex h-7 items-center gap-1 border border-border dark:border-[#333333] bg-background dark:bg-[#1a1a1a] px-2 text-[10px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-100"
              aria-label="Export CSV"
            >
              <Download className="size-3.5" strokeWidth={1.5} />
              Export
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setStatusTab(t.id);
                setPage(1);
              }}
              className={cn(
                "h-7 px-2.5 text-[10px] font-semibold uppercase tracking-widest transition-colors",
                statusTab === t.id
                  ? "border-b-2 border-zinc-100 bg-background dark:bg-[#242424] text-zinc-100"
                  : "text-zinc-500 hover:bg-background dark:bg-[#242424] hover:text-zinc-300",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {showFilters ? (
        <div className="border-b border-border dark:border-[#282828] bg-background dark:bg-[#131313] px-4 py-2 text-[11px] text-zinc-500 sm:px-6">
          Filter by status tabs and search terms; lead actions remain available via row menu.
        </div>
      ) : null}

        <ul className="mb-4 space-y-3 md:hidden">
          {slice.length === 0 ? (
            <li className="rounded-sm border border-border bg-card px-4 py-10 text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
              No leads match this view.
            </li>
          ) : (
            slice.map((lead) => {
              const { line1, line2 } = splitPropertyAddress(lead.propertyAddress);
              const pill = pipelinePill(lead.status);
              return (
                <li key={`m-${lead.id}`} className="border border-border dark:border-[#282828] bg-background dark:bg-[#161616] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center border border-border dark:border-[#333333] bg-background dark:bg-[#242424] text-[10px] font-bold text-zinc-100">
                        {initials(lead.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{lead.name}</p>
                        <p className="truncate text-[11px] text-zinc-500">
                          {line1}
                          {line2 ? ` · ${line2}` : ""}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
                        pill.className,
                      )}
                    >
                      {pill.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border dark:border-[#282828] pt-3">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                      {formatDateAdded(lead.createdAt)}
                    </p>
                    <LeadRowActions
                      leadId={lead.id}
                      status={lead.status}
                      qualifiedStatus={lead.qualifiedStatus}
                      variant="menu"
                    />
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="hidden min-h-0 flex-1 overflow-hidden md:block">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-border dark:border-[#282828] bg-background dark:bg-[#161616] text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="border-r border-border dark:border-[#282828] px-4 py-2 font-medium">Lead name</th>
                  <th className="border-r border-border dark:border-[#282828] px-4 py-2 font-medium">Property</th>
                  <th className="border-r border-border dark:border-[#282828] px-4 py-2 font-medium">Stage</th>
                  <th className="border-r border-border dark:border-[#282828] px-4 py-2 font-medium">Source</th>
                  <th className="border-r border-border dark:border-[#282828] px-4 py-2 font-medium">Qualification</th>
                  <th className="border-r border-border dark:border-[#282828] px-4 py-2 font-medium">
                    Response status
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-8 py-16 text-center text-sm text-zinc-500"
                    >
                      No leads match this view. Add a lead or adjust search.
                    </td>
                  </tr>
                ) : (
                  slice.map((lead) => {
                    const { line1, line2 } = splitPropertyAddress(lead.propertyAddress);
                    const src = sourcePresentation(lead.source);
                    const pill = pipelinePill(lead.status);
                    const qualification = qualificationPill(lead.qualifiedStatus);
                    return (
                      <tr
                        key={lead.id}
                        className="group border-b border-border dark:border-[#282828] transition-colors hover:bg-background dark:bg-[#242424]"
                      >
                        <td className="border-r border-border dark:border-[#282828] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center border border-border dark:border-[#333333] bg-background dark:bg-[#1a1a1a] text-[10px] font-bold text-zinc-100">
                              {initials(lead.name)}
                            </div>
                            <div>
                              <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                                {lead.name}
                              </div>
                              <div className="mt-0.5 text-[10px] text-zinc-500">
                                {lead.email ?? "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[240px] border-r border-border dark:border-[#282828] px-4 py-3">
                          <div className="text-sm text-zinc-700 dark:text-zinc-300">{line1}</div>
                          {line2 ? (
                            <div className="mt-0.5 text-[10px] text-zinc-500">
                              {line2}
                            </div>
                          ) : null}
                        </td>
                        <td className="border-r border-border dark:border-[#282828] px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
                              pill.className,
                            )}
                          >
                            {pill.label}
                          </span>
                        </td>
                        <td className="border-r border-border dark:border-[#282828] px-4 py-3">
                          <div className="inline-flex items-center gap-2 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400">
                            <span className={cn("size-1.5 rounded-full", src.dot)} aria-hidden />
                            {src.label}
                          </div>
                        </td>
                        <td className="border-r border-border dark:border-[#282828] px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
                              qualification.className,
                            )}
                          >
                            {qualification.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap border-r border-border dark:border-[#282828] px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-zinc-500">{formatDateAdded(lead.createdAt)}</span>
                            <span className="text-[11px] italic text-zinc-500">
                              {lead.status === "contacted" || lead.status === "viewing"
                                ? "Replied"
                                : "Pending"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                            <LeadRowActions
                              leadId={lead.id}
                              status={lead.status}
                              qualifiedStatus={lead.qualifiedStatus}
                              variant="menu"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-border dark:border-[#282828] bg-background dark:bg-[#161616] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">
              Showing {displayFrom}–{displayTo} of {total} leads
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">
                {safePage}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        </div>

        {pageCount > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-2 px-4 pb-4 md:hidden">
            <button
              type="button"
              aria-label="Previous page"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border border-border dark:border-[#333333] bg-background dark:bg-[#1a1a1a] p-2 text-zinc-500 transition hover:text-zinc-100 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              {displayFrom}–{displayTo} of {total}
            </p>
            <button
              type="button"
              aria-label="Next page"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="border border-border dark:border-[#333333] bg-background dark:bg-[#1a1a1a] p-2 text-zinc-500 transition hover:text-zinc-100 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}
    </div>
  );
}
