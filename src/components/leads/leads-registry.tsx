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
  if (s.includes("referral")) return { label: source ?? "Source", dot: "bg-[#BD9952]/80" };
  if (s.includes("walk")) return { label: source ?? "Source", dot: "bg-emerald-400/60" };
  if (s.includes("social")) return { label: source ?? "Source", dot: "bg-fuchsia-400/60" };
  if (s === "other" || !source?.trim())
    return { label: source?.trim() || "Direct", dot: "bg-[#BD9952]/60" };
  return { label: source ?? "Direct", dot: "bg-[#767575]/80" };
}

function pipelinePill(status: string): { label: string; className: string } {
  const s = status.toLowerCase();
  const map: Record<string, { label: string; className: string }> = {
    new: {
      label: "NEW",
      className:
        "border border-[#afefdd]/25 bg-[#1a2e28]/80 text-[#afefdd]",
    },
    contacted: {
      label: "CONTACTED",
      className:
        "border border-[#484848]/30 bg-[#474646]/40 text-[#d2d0cf]",
    },
    viewing: {
      label: "VIEWING SCHEDULED",
      className:
        "border border-[#4f3700]/40 bg-[#4f3700]/25 text-[#f8cf83]",
    },
    applied: {
      label: "REFERENCING",
      className:
        "border border-[#306f60]/30 bg-[#206153]/20 text-[#afefdd]",
    },
    approved: {
      label: "APPROVED",
      className:
        "border border-emerald-500/25 bg-emerald-950/30 text-emerald-300",
    },
    rejected: {
      label: "REJECTED",
      className: "border border-[#BB5551]/30 bg-[#7f2927]/20 text-[#ee7d77]",
    },
  };
  return (
    map[s] ?? {
      label: status.replace(/_/g, " ").toUpperCase(),
      className: "border border-[#484848]/30 bg-[#474646]/30 text-muted-foreground",
    }
  );
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
    <div className="relative flex min-h-0 flex-1 flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-24 size-96 rounded-full bg-[#BD9952]/[0.03] blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl flex-1 px-6 pb-24 pt-6 md:px-12 md:pt-8">
        <header className="mb-10 flex flex-col gap-6 border-b border-border pb-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-headline text-4xl font-extralight tracking-tight text-foreground md:text-[2.75rem]">
              Lead Management
            </h1>
            <p className="mt-4 font-[family-name:var(--font-inter)] text-lg font-light tracking-wide text-muted-foreground">
              Track prospective tenants and inquiries across your global portfolio with precision.
            </p>
          </div>
          <AddLeadDialog
            properties={properties}
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-3 rounded-sm border border-border px-6 py-3 font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-[0.2em] text-[#BD9952] transition hover:bg-muted/80 dark:hover:bg-[#131313]"
              >
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                Add lead
              </button>
            }
          />
        </header>

        <section className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="border border-border bg-card p-5 transition-colors hover:bg-muted/70 dark:hover:bg-[#1F2020]/80">
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Total leads
            </p>
            <p className="font-headline mt-2 text-2xl font-light tabular-nums text-foreground">
              {stats.total}
            </p>
          </div>
          <div className="border border-border bg-card p-5 transition-colors hover:bg-muted/70 dark:hover:bg-[#1F2020]/80">
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              New
            </p>
            <p className="font-headline mt-2 text-2xl font-light tabular-nums text-[#BD9952]">
              {stats.newCount}
            </p>
          </div>
          <div className="border border-border bg-card p-5 transition-colors hover:bg-muted/70 dark:hover:bg-[#1F2020]/80">
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Qualified
            </p>
            <p className="font-headline mt-2 text-2xl font-light tabular-nums text-[#afefdd]">
              {stats.qualifiedCount}
            </p>
          </div>
          <div className="border border-border bg-card p-5 transition-colors hover:bg-muted/70 dark:hover:bg-[#1F2020]/80">
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Viewings
            </p>
            <p className="font-headline mt-2 text-2xl font-light tabular-nums text-foreground">
              {stats.viewingCount}
            </p>
          </div>
        </section>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search leads, properties, or inquiries…"
              className="w-full border-0 border-b border-border bg-transparent py-2 pl-10 pr-4 font-[family-name:var(--font-inter)] text-xs text-foreground placeholder:text-placeholder-foreground focus:border-secondary focus:outline-none focus:ring-0"
              aria-label="Search leads"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setStatusTab(t.id);
                  setPage(1);
                }}
                className={cn(
                  "rounded-sm px-3 py-1.5 font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest transition-colors",
                  statusTab === t.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border/80 px-8 py-5">
            <h2 className="font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground">
              Active inquiries
            </h2>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  "text-muted-foreground transition hover:text-foreground",
                  showFilters && "text-[#BD9952]",
                )}
                aria-label="Toggle filters"
                aria-pressed={showFilters}
              >
                <Filter className="size-5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => downloadCsv(filtered)}
                className="text-muted-foreground transition hover:text-foreground"
                aria-label="Export CSV"
              >
                <Download className="size-5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {showFilters ? (
            <div className="border-b border-[#484848]/10 px-8 py-3 font-[family-name:var(--font-inter)] text-xs text-muted-foreground">
              Filter by pipeline using the chips above. Search matches name, email, phone, and
              property.
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#484848]/5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-8 py-5 font-medium">Lead name</th>
                  <th className="px-8 py-5 font-medium">Property interest</th>
                  <th className="px-8 py-5 font-medium">Source</th>
                  <th className="px-8 py-5 font-medium">Status</th>
                  <th className="px-8 py-5 font-medium">Date added</th>
                  <th className="px-8 py-5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-8 py-16 text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground"
                    >
                      No leads match this view. Add a lead or adjust search.
                    </td>
                  </tr>
                ) : (
                  slice.map((lead) => {
                    const { line1, line2 } = splitPropertyAddress(lead.propertyAddress);
                    const src = sourcePresentation(lead.source);
                    const pill = pipelinePill(lead.status);
                    return (
                      <tr
                        key={lead.id}
                        className="group border-b border-border/50 transition-colors hover:bg-muted/70 dark:hover:bg-[#1F2020]/90"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#484848]/10 bg-[#252626] text-[10px] font-bold text-foreground">
                              {initials(lead.name)}
                            </div>
                            <div>
                              <div className="text-sm font-medium tracking-wide text-foreground">
                                {lead.name}
                              </div>
                              <div className="mt-0.5 text-[10px] font-light text-muted-foreground">
                                {lead.email ?? "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[240px] px-8 py-6">
                          <div className="text-sm font-light text-foreground">{line1}</div>
                          {line2 ? (
                            <div className="mt-0.5 text-[10px] font-light text-muted-foreground">
                              {line2}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-8 py-6">
                          <div className="inline-flex items-center gap-2 rounded-sm border border-[#484848]/15 px-2 py-1 font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-muted-foreground">
                            <span className={cn("size-1.5 rounded-full", src.dot)} aria-hidden />
                            {src.label}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-3 py-1 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-widest",
                              pill.className,
                            )}
                          >
                            {pill.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-8 py-6">
                          <span className="font-[family-name:var(--font-inter)] text-[11px] font-light text-muted-foreground">
                            {formatDateAdded(lead.createdAt)}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
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

          <div className="flex flex-col gap-4 border-t border-[#484848]/5 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-muted-foreground">
              Showing {displayFrom}–{displayTo} of {total} leads
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-muted-foreground transition hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-widest text-[#BD9952]">
                {safePage}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="text-muted-foreground transition hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
