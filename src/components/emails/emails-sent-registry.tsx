"use client";

import { ChevronLeft, ChevronRight, Download, Filter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmailDraftViewButton } from "@/components/emails/email-draft-view-button";
import type { EmailDispatchRow } from "@/lib/email-dispatch";
import { isAutomatedEmailDispatch } from "@/lib/email-dispatch";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type LogTab = "all" | "automated" | "manual";

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
  const h = ["Recipient", "Email", "Subject", "Date sent", "Status", "Source"];
  const lines = [h.join(",")];
  for (const r of rows) {
    lines.push(
      [
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
}: {
  rows: EmailDispatchRow[];
  totalDispatched: number;
}) {
  const [tab, setTab] = useState<LogTab>("all");
  const [query, setQuery] = useState("");
  const [statusOnly, setStatusOnly] = useState<EmailDispatchRow["uiStatus"] | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "automated" && !isAutomatedEmailDispatch(r.agentType)) return false;
      if (tab === "manual" && isAutomatedEmailDispatch(r.agentType)) return false;
      if (statusOnly !== "all" && r.uiStatus !== statusOnly) return false;
      if (!q) return true;
      const hay = [r.recipientName, r.recipientEmail, r.subject].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, tab, query, statusOnly]);

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

  const tabs: { id: LogTab; label: string }[] = [
    { id: "all", label: "All" },
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
              {totalDispatched.toLocaleString("en-GB")} total dispatches
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

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-0 flex-col border-r border-[#1f1f1f]">
          <div className="flex h-10 items-center justify-between border-b border-[#1f1f1f] px-4 sm:px-6">
            <div className="flex h-full items-center gap-5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    setPage(1);
                  }}
                  className={cn(
                    "h-full border-b text-[10px] font-bold uppercase tracking-[0.16em] transition-colors",
                    tab === t.id
                      ? "border-white text-white"
                      : "border-transparent text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {t.label}
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
                  <th className="w-[22%] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:px-6">
                    Recipient
                  </th>
                  <th className="w-[32%] px-2 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                    Subject
                  </th>
                  <th className="w-[12%] px-2 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                    Type
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
                      No messages in this view.
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
                      <td className="truncate px-4 py-3 text-zinc-300 sm:px-6">
                        <div className="truncate">{row.recipientEmail}</div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="truncate text-zinc-400">{row.subject}</div>
                      </td>
                      <td className="px-2 py-3">
                        <span className="inline-flex border border-[#2a2a2a] bg-zinc-900/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                          {row.source === "email_log" ? "Workflow" : "Draft"}
                        </span>
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
          <div className="border-b border-[#1f1f1f] px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">Communication Detail</p>
            <h2 className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-200">
              {selected?.subject ?? "No message selected"}
            </h2>
            {selected ? (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="truncate">{selected.recipientEmail}</span>
                <StatusPill status={selected.uiStatus} />
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
            <section>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Message content</h3>
              <div className="border border-[#1f1f1f] bg-zinc-900/30 p-3">
                <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-400">
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
