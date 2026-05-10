"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, Filter, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmailDraftViewButton } from "@/components/emails/email-draft-view-button";
import type { EmailDispatchRow } from "@/lib/email-dispatch";
import { isAutomatedEmailDispatch } from "@/lib/email-dispatch";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

type LogTab = "all" | "tenants" | "automated" | "manual";
type StatusFilter = EmailDispatchRow["uiStatus"] | "all";

/* ── Helpers ─────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDateFull(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getTypeBadge(row: EmailDispatchRow): string {
  if (row.agentType) return row.agentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (row.isTenantRecipient) return "Tenant";
  return row.source === "email_log" ? "System" : "Draft";
}

/* ── Status dot (table cell) ────────────────────────────────────── */
function StatusDot({ status }: { status: EmailDispatchRow["uiStatus"] }) {
  const map: Record<string, { dot: string; text: string; label: string }> = {
    draft:     { dot: "bg-yellow-400",  text: "text-yellow-400",  label: "Draft" },
    delivered: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Sent" },
    opened:    { dot: "bg-emerald-300", text: "text-emerald-300", label: "Opened" },
    bounced:   { dot: "bg-red-400",     text: "text-red-400",     label: "Failed" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span className={cn("flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider", s.text)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function StatusPill({ status }: { status: EmailDispatchRow["uiStatus"] }) {
  const map: Record<string, string> = {
    draft:     "border border-yellow-700/40 bg-yellow-950/30 text-yellow-400",
    delivered: "border border-emerald-800/40 bg-emerald-950/25 text-emerald-400",
    opened:    "border border-emerald-700/40 bg-emerald-950/20 text-emerald-300",
    bounced:   "border border-red-800/40 bg-red-950/25 text-red-400",
  };
  const labels: Record<string, string> = { draft: "Draft", delivered: "Sent", opened: "Opened", bounced: "Failed" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest", map[status] ?? map.draft)}>
      {labels[status] ?? status}
    </span>
  );
}

/* ── CSV export ──────────────────────────────────────────────────── */
function downloadCsv(rows: EmailDispatchRow[]) {
  const h = ["Recipient", "Email", "Subject", "Date", "Status", "Source"];
  const lines = [h.join(",")];
  for (const r of rows) {
    lines.push([
      `"${r.recipientName.replace(/"/g, '""')}"`,
      `"${r.recipientEmail.replace(/"/g, '""')}"`,
      `"${r.subject.replace(/"/g, '""')}"`,
      r.sentAt,
      r.uiStatus,
      r.source,
    ].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `letora-emails-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Main Component ──────────────────────────────────────────────── */
export function EmailsSentRegistry({
  rows,
  totalDispatched,
  initialLogId,
}: {
  rows: EmailDispatchRow[];
  totalDispatched: number;
  initialLogId?: string | null;
}) {
  const [tab, setTab] = useState<LogTab>("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  function closeInspector() {
    setInspectorOpen(false);
    setSelectedId(null);
  }

  function openRow(id: string) {
    setSelectedId(id);
    setInspectorOpen(true);
  }

  const tenantTotal = useMemo(() => rows.filter((r) => r.isTenantRecipient).length, [rows]);
  const draftCount = useMemo(() => rows.filter((r) => r.uiStatus === "draft").length, [rows]);
  const failedCount = useMemo(() => rows.filter((r) => r.uiStatus === "bounced").length, [rows]);

  /* deep-link from Approvals */
  useEffect(() => {
    if (!initialLogId?.trim()) return;
    const hit = rows.find((r) => r.source === "email_log" && r.id === initialLogId.trim());
    if (hit) { setSelectedId(hit.id); setTab("all"); }
  }, [initialLogId, rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "tenants" && !r.isTenantRecipient) return false;
      if (tab === "automated" && !isAutomatedEmailDispatch(r.agentType)) return false;
      if (tab === "manual" && isAutomatedEmailDispatch(r.agentType)) return false;
      if (statusFilter !== "all" && r.uiStatus !== statusFilter) return false;
      if (!q) return true;
      return [r.recipientName, r.recipientEmail, r.subject].join(" ").toLowerCase().includes(q);
    });
  }, [rows, tab, query, statusFilter]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const selected = useMemo(() => {
    if (!inspectorOpen) return null;
    const hit = slice.find((r) => r.id === selectedId);
    return hit ?? (inspectorOpen ? (slice[0] ?? null) : null);
  }, [selectedId, slice, inspectorOpen]);

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const TABS: { id: LogTab; label: string; badge?: number | string }[] = [
    { id: "all",       label: "All" },
    { id: "tenants",   label: "To Tenants", badge: tenantTotal },
    { id: "automated", label: "Automated" },
    { id: "manual",    label: "Manual" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background dark:bg-[#0B0B0B] text-[#e5e2e1]">

      {/* ── Page header ── */}
      <header className="border-b border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0B0B0B] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#555555]">
              Communications Hub
            </p>
            <h1 className="mt-1 text-xl font-bold uppercase tracking-tight text-zinc-900 dark:text-white">
              Emails
            </h1>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-[#555555]">
              {totalDispatched.toLocaleString("en-GB")} total dispatches · {tenantTotal.toLocaleString("en-GB")} to tenants
            </p>
          </div>

          {/* Search + Export */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#444748]" />
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search communications..."
                className="h-8 w-64 border border-border dark:border-[#282828] bg-background dark:bg-[#0a0a0a] pl-8 pr-3 font-mono text-[10px] text-[#c4c7c8] placeholder-[#444748] focus:border-white focus:outline-none"
                aria-label="Search emails"
              />
            </div>
            <button
              type="button"
              onClick={() => downloadCsv(filtered)}
              className="inline-flex h-8 items-center gap-1.5 border border-border dark:border-[#282828] bg-background dark:bg-[#0a0a0a] px-3 font-mono text-[9px] font-bold uppercase tracking-widest text-[#888888] transition-colors hover:text-white"
            >
              <Download className="size-3" />
              Export
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: table + inspector ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── Left: Communications Table ── */}
        <section className={cn(
          "flex min-h-0 flex-col overflow-hidden transition-all",
          inspectorOpen && selected ? "flex-1 border-r border-border dark:border-[#1f1f1f]" : "w-full flex-1"
        )}>

          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0B0B0B] px-6">
            <div className="flex h-11 items-center gap-6">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTab(t.id); setPage(1); }}
                  className={cn(
                    "flex h-full items-center gap-1.5 border-b-[1.5px] font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
                    tab === t.id
                      ? "border-white text-zinc-900 dark:text-white"
                      : "border-transparent text-[#555555] hover:text-[#c4c7c8]",
                  )}
                >
                  {t.label}
                  {t.badge !== undefined && (
                    <span className={cn(
                      "rounded-sm border px-1 py-px text-[8px] font-bold tabular-nums",
                      tab === t.id ? "border-border dark:border-[#333333] bg-background dark:bg-[#1a1a1a] text-[#888888]" : "border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0e0e0e] text-[#444748]"
                    )}>
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
              {draftCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setStatusFilter(statusFilter === "draft" ? "all" : "draft"); setPage(1); }}
                  className={cn(
                    "flex h-full items-center gap-1.5 border-b-[1.5px] font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
                    statusFilter === "draft"
                      ? "border-white text-zinc-900 dark:text-white"
                      : "border-transparent text-[#555555] hover:text-[#c4c7c8]",
                  )}
                >
                  Drafts
                  <span className="rounded-sm border border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0e0e0e] px-1 py-px text-[8px] font-bold tabular-nums text-[#444748]">
                    {draftCount}
                  </span>
                </button>
              )}
              {failedCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setStatusFilter(statusFilter === "bounced" ? "all" : "bounced"); setPage(1); }}
                  className={cn(
                    "flex h-full items-center gap-1.5 border-b-[1.5px] font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
                    statusFilter === "bounced"
                      ? "border-white text-zinc-900 dark:text-white"
                      : "border-transparent text-[#555555] hover:text-[#c4c7c8]",
                  )}
                >
                  Failed
                  <span className="rounded-sm border border-border dark:border-[#BB5551]/30 bg-background dark:bg-[#7f2927]/10 px-1 py-px text-[8px] font-bold tabular-nums text-[#ee7d77]">
                    {failedCount}
                  </span>
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <Filter className="size-3 text-[#444748]" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
                className="h-7 border border-border dark:border-[#282828] bg-background dark:bg-[#0a0a0a] px-2 font-mono text-[9px] uppercase tracking-wider text-[#888888] focus:outline-none"
              >
                <option value="all">All status</option>
                <option value="draft">Draft</option>
                <option value="delivered">Sent</option>
                <option value="opened">Opened</option>
                <option value="bounced">Failed</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0B0B0B]">
                  <th className="w-[22%] py-2.5 pl-6 pr-4 font-mono text-[9px] font-bold uppercase tracking-widest text-[#555555]">Recipient</th>
                  <th className="w-[30%] px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#555555]">Subject</th>
                  <th className="w-[13%] px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#555555]">Type</th>
                  <th className="w-[13%] px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#555555]">Status</th>
                  <th className="w-[12%] py-2.5 pl-4 pr-6 text-right font-mono text-[9px] font-bold uppercase tracking-widest text-[#555555]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {slice.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center font-mono text-[11px] text-[#444748]">
                      {tab === "tenants"
                        ? "No tenant emails logged yet."
                        : "No messages match this view."}
                    </td>
                  </tr>
                ) : (
                  slice.map((row) => {
                    const isSelected = selected?.id === row.id;
                    return (
                      <tr
                        key={`${row.source}-${row.id}`}
                        onClick={() => openRow(row.id)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected && inspectorOpen
                            ? "border-l-2 border-white bg-background dark:bg-[#181818]"
                            : row.uiStatus === "bounced"
                              ? "border-l-2 border-transparent bg-red-950/[0.04] hover:bg-background dark:bg-[#1a1a1a]"
                              : row.uiStatus === "draft"
                                ? "border-l-2 border-transparent bg-yellow-950/[0.03] hover:bg-background dark:bg-[#131313]"
                                : "border-l-2 border-transparent hover:bg-background dark:bg-[#131313]",
                        )}
                      >
                        <td className="py-3 pl-5 pr-4 font-mono text-[11px]">
                          {row.isTenantRecipient ? (
                            <div className="min-w-0">
                              <div className={cn("truncate text-[11px] font-semibold", isSelected ? "text-zinc-900 dark:text-white" : "text-[#c4c7c8]")}>
                                {row.recipientName}
                              </div>
                              <div className="truncate text-[10px] text-[#555555]">{row.recipientEmail}</div>
                            </div>
                          ) : (
                            <div className="truncate text-[10px] text-[#888888]">{row.recipientEmail}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn("line-clamp-2 text-[11px] leading-snug", isSelected ? "text-[#e5e2e1]" : "text-[#888888]")}>
                            {row.subject}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block border border-border dark:border-[#282828] bg-background dark:bg-[#0e0e0e] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#555555]">
                            {getTypeBadge(row)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusDot status={row.uiStatus} />
                        </td>
                        <td className="py-3 pl-4 pr-6 text-right font-mono text-[10px] text-[#555555]">
                          {formatDate(row.sentAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0B0B0B] px-6 py-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#444748]">
              Page {safePage} / {pageCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex size-6 items-center justify-center border border-border dark:border-[#282828] text-[#555555] transition-colors hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="flex size-6 items-center justify-center border border-border dark:border-[#282828] text-[#555555] transition-colors hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* ── Right: Inspector Panel (conditional) ── */}
        {inspectorOpen && selected && (
        <aside className="flex w-80 shrink-0 flex-col border-l border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0B0B0B]">

          {/* Inspector header */}
          <div className="border-b border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0e0e0e] px-5 pb-4 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#444748]">
                Communication Detail
              </span>
              <button
                type="button"
                onClick={closeInspector}
                className="text-[#444748] transition-colors hover:text-zinc-900 dark:hover:text-zinc-900 dark:text-white"
                aria-label="Close inspector"
              >
                <X className="size-4" />
              </button>
            </div>
            {selected ? (
              <>
                <h2 className="text-[13px] font-bold leading-snug text-zinc-900 dark:text-white">
                  {selected.subject}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] text-[#888888]">{selected.recipientEmail}</span>
                  <StatusPill status={selected.uiStatus} />
                </div>
              </>
            ) : (
              <p className="text-[11px] text-[#444748]">Select a message to view details.</p>
            )}
          </div>

          {/* Inspector tabs */}
          {selected && (
            <div className="flex border-b border-border dark:border-[#1f1f1f] px-5">
              {["Overview", "Activity", "Files"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    "py-2.5 pr-4 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors",
                    t === "Overview"
                      ? "border-b border-white text-zinc-900 dark:text-white"
                      : "text-[#444748] hover:text-[#888888]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Inspector body */}
          <div className="min-h-0 flex-1 space-y-6 overflow-auto p-5">
            {selected ? (
              <>
                {/* Message content */}
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#444748]">
                      Message Content
                    </h3>
                    {/* Always-visible Full Preview button */}
                    <EmailDraftViewButton
                      subject={selected.subject}
                      body={selected.body}
                      buttonClassName="inline-flex items-center gap-1 border-0 bg-transparent px-0 py-0 font-mono text-[9px] font-bold uppercase tracking-widest text-[#888888] hover:text-zinc-900 dark:hover:text-zinc-900 dark:text-white transition-colors"
                    />
                  </div>
                  <div className="border border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0e0e0e] p-4">
                    <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-[#888888]">
                      {selected.body || "No body content available."}
                    </pre>
                  </div>
                </section>

                {/* Meta info */}
                <section className="space-y-2">
                  <h3 className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#444748]">
                    Details
                  </h3>
                  <div className="space-y-1.5">
                    {[
                      { label: "Recipient", val: selected.recipientName },
                      { label: "Email", val: selected.recipientEmail },
                      { label: "Type", val: getTypeBadge(selected) },
                      { label: "Date", val: formatDateFull(selected.sentAt) },
                      { label: "Status", val: selected.uiStatus.toUpperCase() },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex items-start justify-between gap-2 border-b border-border dark:border-[#0e0e0e] pb-1.5">
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-[#444748]">{label}</span>
                        <span className="truncate text-right font-mono text-[10px] text-[#888888]">{val}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Activity log */}
                <section>
                  <h3 className="mb-4 font-mono text-[9px] font-bold uppercase tracking-widest text-[#444748]">
                    Activity Log
                  </h3>
                  <div className="relative space-y-4 border-l border-border dark:border-[#1f1f1f] pl-4">
                    <div className="relative">
                      <span className="absolute -left-[17px] top-1.5 size-2 rounded-full border border-border dark:border-[#333333] bg-background dark:bg-[#0B0B0B]" />
                      <p className="text-[11px] font-semibold text-[#c4c7c8]">Created</p>
                      <p className="font-mono text-[9px] text-[#444748]">{formatDateFull(selected.sentAt)}</p>
                    </div>
                    <div className="relative">
                      <span className={cn(
                        "absolute -left-[17px] top-1.5 size-2 rounded-full",
                        selected.uiStatus === "delivered" ? "bg-emerald-400" :
                        selected.uiStatus === "opened" ? "bg-amber-400" :
                        selected.uiStatus === "bounced" ? "bg-background dark:bg-[#ee7d77]" :
                        "border border-border dark:border-[#333333] bg-background dark:bg-[#0B0B0B]"
                      )} />
                      <p className={cn(
                        "text-[11px] font-bold",
                        selected.uiStatus === "delivered" ? "text-emerald-400" :
                        selected.uiStatus === "opened" ? "text-amber-400" :
                        selected.uiStatus === "bounced" ? "text-[#ee7d77]" :
                        "text-[#888888]"
                      )}>
                        {selected.uiStatus === "delivered" ? "Delivered" :
                         selected.uiStatus === "opened" ? "Opened" :
                         selected.uiStatus === "bounced" ? "Delivery Failed" :
                         "Draft Saved"}
                      </p>
                      <p className="font-mono text-[9px] text-[#444748]">{formatDateFull(selected.sentAt)}</p>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#333333]">
                  No message selected
                </p>
                <p className="mt-2 text-[10px] text-[#2a2a2a]">
                  Click a row to view communication details.
                </p>
              </div>
            )}
          </div>

          {/* Inspector actions */}
          <div className="space-y-2 border-t border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0e0e0e] p-4">
            <EmailDraftViewButton
              subject={selected.subject}
              body={selected.body}
              buttonClassName="inline-flex w-full items-center justify-center gap-2 bg-white py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#161616] transition-opacity hover:opacity-90"
            />
            <button
              type="button"
              onClick={closeInspector}
              className="w-full border border-border dark:border-[#282828] py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#555555] transition-colors hover:border-border dark:border-[#444444] hover:text-[#888888]"
            >
              Discard
            </button>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}
