"use client";

import { ChevronLeft, ChevronRight, Download, Filter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmailDraftViewButton } from "@/components/emails/email-draft-view-button";
import type { EmailDispatchRow } from "@/lib/email-dispatch";
import { isAutomatedEmailDispatch } from "@/lib/email-dispatch";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type LogTab = "tenants" | "all" | "automated" | "manual";

function formatSentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} · ${time}`;
}

function StatusPill({ status }: { status: EmailDispatchRow["uiStatus"] }) {
  if (status === "draft") {
    return (
      <span className="inline-flex items-center gap-1.5 border border-zinc-600/40 bg-zinc-900/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400/95">
        <span className="size-1 rounded-full bg-zinc-500" />
        Draft
      </span>
    );
  }
  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-1.5 border border-emerald-900/30 bg-emerald-950/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400/90">
        <span className="size-1 rounded-full bg-emerald-400" />
        Delivered
      </span>
    );
  }
  if (status === "opened") {
    return (
      <span className="inline-flex items-center gap-1.5 border border-amber-900/35 bg-amber-950/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400/90">
        <span className="size-1 rounded-full bg-amber-400" />
        Opened
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 border border-red-900/35 bg-red-950/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400/90">
      <span className="size-1 rounded-full bg-red-400" />
      Bounced
    </span>
  );
}

function downloadCsv(rows: EmailDispatchRow[]) {
  const h = ["Tenant", "Recipient", "Email", "Subject", "Date sent", "Status", "Source"];
  const lines = [h.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.isTenantRecipient ? "yes" : "no",
        `"${r.recipientName.replace(/"/g, '""')}"`,
        `"${r.recipientEmail.replace(/"/g, '""')}"`,
        `"${r.subject.replace(/"/g, '""')}"`,
        r.sentAt,
        r.uiStatus,
        r.source,
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `letora-emails-sent-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EmailsSentRegistry({
  rows,
  totalDispatched,
  initialLogId,
}: {
  rows: EmailDispatchRow[];
  totalDispatched: number;
  /** Deep-link from Approvals audit: select this `email_logs` row when present. */
  initialLogId?: string | null;
}) {
  const [tab, setTab] = useState<LogTab>("tenants");
  const [query, setQuery] = useState("");
  const [statusOnly, setStatusOnly] = useState<EmailDispatchRow["uiStatus"] | "all">("all");
  const [page, setPage] = useState(1);
  const tenantRows = useMemo(() => rows.filter((r) => r.isTenantRecipient), [rows]);
  const tenantTotal = tenantRows.length;
  const [selectedId, setSelectedId] = useState<string | null>(
    tenantRows[0]?.id ?? rows[0]?.id ?? null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "tenants" && !r.isTenantRecipient) return false;
      if (tab === "automated" && !isAutomatedEmailDispatch(r.agentType)) return false;
      if (tab === "manual" && isAutomatedEmailDispatch(r.agentType)) return false;
      if (statusOnly !== "all" && r.uiStatus !== statusOnly) return false;
      if (!q) return true;
      const hay = [r.recipientName, r.recipientEmail, r.subject].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, tab, query, statusOnly]);

  useEffect(() => {
    if (!initialLogId?.trim()) return;
    const id = initialLogId.trim();
    const hit = rows.find((r) => r.source === "email_log" && r.id === id);
    if (!hit) return;
    setSelectedId(hit.id);
    if (hit.isTenantRecipient) setTab("tenants");
    if (hit.uiStatus === "draft") setStatusOnly("draft");
  }, [initialLogId, rows]);

  useEffect(() => {
    if (!initialLogId?.trim()) return;
    const id = initialLogId.trim();
    const idx = filtered.findIndex((r) => r.source === "email_log" && r.id === id);
    if (idx < 0) return;
    setPage(Math.floor(idx / PAGE_SIZE) + 1);
  }, [initialLogId, filtered]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  const selected = useMemo(() => {
    if (slice.length === 0) return null;
    const row = slice.find((item) => item.id === selectedId);
    return row ?? slice[0];
  }, [selectedId, slice]);

  useEffect(() => {
    if (!selected) {
      setSelectedId(null);
      return;
    }
    if (selectedId !== selected.id) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId]);

  const tabs: { id: LogTab; label: string; hint?: string }[] = [
    { id: "tenants", label: "To tenants", hint: `${tenantTotal}` },
    { id: "all", label: "All mail" },
    { id: "automated", label: "Automated" },
    { id: "manual", label: "Manual" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0B0B0B] text-[#e5e2e1]">
      <div className="border-b border-[#1f1f1f] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <h1 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">Communications Hub</h1>
            <span className="hidden text-[11px] text-zinc-500 sm:inline">
              {totalDispatched.toLocaleString("en-GB")} total dispatches ·{" "}
              <span className="text-zinc-400">{tenantTotal.toLocaleString("en-GB")} to tenants</span>
            </span>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search communications..."
                className="h-8 w-full border border-[#2a2a2a] bg-[#0a0a0a] pl-7 pr-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
                aria-label="Search emails"
              />
            </div>
            <button
              type="button"
              onClick={() => downloadCsv(filtered)}
              className="inline-flex h-8 items-center gap-1.5 border border-[#2a2a2a] px-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
            >
              <Download className="size-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      <section
        className="border-b border-[#BD9952]/25 bg-gradient-to-b from-[#1a1814]/95 to-[#0B0B0B] px-4 py-5 sm:px-6"
        aria-label="Tenant email summary"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl space-y-2">
            <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#BD9952]">
              Tenant communications
            </p>
            <h2 className="font-headline text-xl font-light tracking-tight text-white sm:text-2xl">
              See every email sent to your tenants
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Welcome and move-in messages, rent chases, maintenance acknowledgements, and other workflow mail to tenant
              addresses on your portfolio. Switch tabs to include contractor or landlord-only messages.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1 border border-white/[0.08] bg-black/20 px-5 py-4 sm:items-end">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-zinc-500">Tenant messages logged</p>
            <p className="font-mono text-4xl font-light tabular-nums leading-none text-white">{tenantTotal}</p>
          </div>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <section className="flex min-h-0 flex-col border-r border-[#1f1f1f]">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-[#1f1f1f] px-4 sm:px-6">
            <div className="flex h-full min-h-10 flex-wrap items-center gap-x-4 gap-y-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setPage(1);
                  }}
                  className={cn(
                    "border-b-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                    tab === t.id
                      ? "border-[#BD9952] text-white"
                      : "border-transparent text-zinc-500 hover:text-zinc-300",
                    t.id === "tenants" && tab === t.id && "text-[#e8d4a8]",
                  )}
                >
                  {t.label}
                  {t.hint ? (
                    <span className="ml-1.5 tabular-nums opacity-80">({t.hint})</span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-zinc-600" />
              <select
                value={statusOnly}
                onChange={(e) => {
                  setStatusOnly(e.target.value as typeof statusOnly);
                  setPage(1);
                }}
                className="h-7 border border-[#2a2a2a] bg-[#0a0a0a] px-2 text-[10px] uppercase tracking-wider text-zinc-400 focus:outline-none"
              >
                <option value="all">All status</option>
                <option value="draft">Draft</option>
                <option value="delivered">Delivered</option>
                <option value="opened">Opened</option>
                <option value="bounced">Bounced</option>
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-[#1f1f1f] bg-[#0B0B0B]">
                  <th className="w-[26%] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:px-6">
                    To
                  </th>
                  <th className="w-[34%] px-2 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                    Subject
                  </th>
                  <th className="w-[12%] px-2 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                    Audience
                  </th>
                  <th className="w-[16%] px-2 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                    Status
                  </th>
                  <th className="w-[18%] px-2 py-2 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:px-6">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f] font-mono text-[11px]">
                {slice.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center font-sans text-sm text-zinc-500">
                      {tab === "tenants"
                        ? "No tenant emails logged yet. When onboarding, rent chases, or maintenance messages go to a tenant address, they appear here."
                        : "No messages in this view."}
                    </td>
                  </tr>
                ) : (
                  slice.map((row) => (
                    <tr
                      key={`${row.source}-${row.id}`}
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-zinc-900/50",
                        selected?.id === row.id ? "bg-zinc-900/70" : "",
                      )}
                    >
                      <td className="px-4 py-3 sm:px-6">
                        {row.isTenantRecipient ? (
                          <div className="min-w-0">
                            <div className="truncate font-sans text-[13px] font-semibold text-white">
                              {row.recipientName}
                            </div>
                            <div className="truncate font-mono text-[11px] text-zinc-500">{row.recipientEmail}</div>
                          </div>
                        ) : (
                          <div className="min-w-0 truncate font-mono text-[11px] text-zinc-400">{row.recipientEmail}</div>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="line-clamp-2 font-sans text-[12px] leading-snug text-zinc-300">{row.subject}</div>
                      </td>
                      <td className="px-2 py-3">
                        {row.isTenantRecipient ? (
                          <span className="inline-flex border border-emerald-800/40 bg-emerald-950/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300/95">
                            Tenant
                          </span>
                        ) : (
                          <span className="inline-flex border border-[#2a2a2a] bg-zinc-900/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                            {row.source === "email_log" ? "Other" : "Draft"}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <StatusPill status={row.uiStatus} />
                      </td>
                      <td className="px-2 py-3 text-right text-zinc-600 sm:px-6">
                        {formatSentDate(row.sentAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#1f1f1f] px-4 py-2 sm:px-6">
            <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              Page {safePage} / {pageCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex size-6 items-center justify-center border border-[#2a2a2a] text-zinc-500 hover:text-white disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="flex size-6 items-center justify-center border border-[#2a2a2a] text-zinc-500 hover:text-white disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-t border-[#1f1f1f] bg-[#0B0B0B] xl:border-l xl:border-t-0">
          <div className="border-b border-[#1f1f1f] px-4 py-5">
            {selected?.isTenantRecipient ? (
              <p className="inline-flex border border-emerald-800/45 bg-emerald-950/30 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-emerald-300/95">
                Tenant message
              </p>
            ) : (
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">Communication detail</p>
            )}
            <h2
              className={cn(
                "mt-3 line-clamp-4 font-headline font-light tracking-tight text-zinc-100",
                selected?.isTenantRecipient ? "text-lg sm:text-xl" : "text-sm font-semibold",
              )}
            >
              {selected?.subject ?? "No message selected"}
            </h2>
            {selected ? (
              <div className="mt-3 space-y-1">
                <p className="font-sans text-sm font-medium text-white">{selected.recipientName}</p>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
                  <span className="truncate font-mono">{selected.recipientEmail}</span>
                  <StatusPill status={selected.uiStatus} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
            <section>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Message content</h3>
              <div
                className={cn(
                  "border bg-zinc-900/30 p-4",
                  selected?.isTenantRecipient ? "border-emerald-900/25" : "border-[#1f1f1f]",
                )}
              >
                <pre
                  className={cn(
                    "whitespace-pre-wrap break-words leading-relaxed text-zinc-300",
                    selected?.isTenantRecipient ? "font-sans text-[0.9375rem]" : "font-mono text-[11px] text-zinc-400",
                  )}
                >
                  {selected?.body ?? "Select a message to preview body content."}
                </pre>
              </div>
            </section>

            {selected ? (
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Actions</h3>
                <EmailDraftViewButton
                  subject={selected.subject}
                  body={selected.body}
                  buttonClassName="h-8 w-full border-[#2a2a2a] bg-transparent px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900/40 hover:text-white"
                />
              </section>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
