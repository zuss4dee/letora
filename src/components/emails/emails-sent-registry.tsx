"use client";

import { ChevronLeft, ChevronRight, Download, Filter } from "lucide-react";
import { useMemo, useState } from "react";

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
      <span className="inline-flex items-center rounded-full border border-[#afefdd]/25 bg-[#1a2e28]/60 px-3 py-1 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-widest text-[#afefdd]">
        Delivered
      </span>
    );
  }
  if (status === "opened") {
    return (
      <span className="inline-flex items-center rounded-full border border-[#4f3700]/35 bg-[#4f3700]/20 px-3 py-1 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-widest text-[#e1ba70]">
        Opened
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[#7f2927]/35 bg-[#7f2927]/25 px-3 py-1 font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-widest text-[#ee7d77]">
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [statusOnly, setStatusOnly] = useState<EmailDispatchRow["uiStatus"] | "all">("all");
  const [page, setPage] = useState(1);

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

  const tabs: { id: LogTab; label: string }[] = [
    { id: "all", label: "All logs" },
    { id: "automated", label: "Automated" },
    { id: "manual", label: "Manual" },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-background">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />

      <div className="relative z-[1] mx-auto w-full max-w-7xl flex-1 px-4 pb-8 pt-4 sm:px-6 md:px-12 md:pb-24 md:pt-10">
        <header className="mb-6 max-w-3xl md:mb-12">
          <h1 className="font-headline text-2xl font-extralight leading-none tracking-tight text-foreground sm:text-3xl md:text-[3.5rem]">
            Emails Sent
          </h1>
          <p className="mt-3 hidden max-w-xl font-[family-name:var(--font-inter)] text-sm text-muted-foreground sm:block">
            A clinical log of all outgoing property management communications and tenant notices.
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-3 border-b border-border/80 pb-3 md:mb-10 md:flex-row md:items-center md:justify-between md:pb-4">
          <div className="flex flex-nowrap gap-4 overflow-x-auto md:flex-wrap md:gap-8">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
                className={cn(
                  "pb-4 font-[family-name:var(--font-inter)] text-[11px] uppercase tracking-[0.2em] transition-colors",
                  tab === t.id
                    ? "border-b border-[#BD9952] font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className={cn(
              "ml-auto flex items-center gap-2 font-[family-name:var(--font-inter)] text-[11px] uppercase tracking-widest transition-colors",
              advancedOpen ? "text-[#BD9952]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Filter className="size-4" strokeWidth={1.5} />
            Advanced filters
          </button>
        </div>

        {advancedOpen ? (
          <div className="mb-8 flex flex-wrap items-center gap-4 rounded-sm border border-border bg-card/80 px-4 py-3">
            <span className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-muted-foreground">
              Delivery status
            </span>
            <select
              value={statusOnly}
              onChange={(e) => {
                setStatusOnly(e.target.value as typeof statusOnly);
                setPage(1);
              }}
              className="border-0 bg-transparent font-[family-name:var(--font-inter)] text-xs text-muted-foreground focus:outline-none focus:ring-0"
            >
              <option value="all">All statuses</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened</option>
              <option value="bounced">Bounced</option>
            </select>
            <button
              type="button"
              onClick={() => downloadCsv(filtered)}
              className="ml-auto inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#BD9952] hover:underline"
            >
              <Download className="size-3.5" />
              Export view
            </button>
          </div>
        ) : null}

        <div className="mb-6 max-w-md">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search communications…"
            className="w-full border-0 border-b border-border bg-transparent py-2 font-[family-name:var(--font-inter)] text-sm text-foreground placeholder:text-placeholder-foreground focus:border-secondary focus:outline-none focus:ring-0"
            aria-label="Search emails"
          />
        </div>

        <ul className="space-y-3 md:hidden">
          {slice.length === 0 ? (
            <li className="rounded-sm bg-card px-4 py-10 text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
              No messages in this view.
            </li>
          ) : (
            slice.map((row) => (
              <li
                key={`m-${row.source}-${row.id}`}
                className="rounded-sm bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{row.recipientName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.recipientEmail}</p>
                  </div>
                  <StatusPill status={row.uiStatus} />
                </div>
                <p className="mt-3 line-clamp-2 text-[13px] text-muted-foreground">{row.subject}</p>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                  <span className="text-[11px] font-light text-muted-foreground">
                    {formatSentDate(row.sentAt)}
                  </span>
                  <EmailDraftViewButton
                    subject={row.subject}
                    body={row.body}
                    buttonClassName="border-[#484848]/30 bg-transparent font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#BD9952] hover:border-[#BD9952]/50 hover:bg-[#BD9952]/5 hover:text-[#BD9952]"
                  />
                </div>
              </li>
            ))
          )}
        </ul>

        <div className="hidden space-y-0.5 md:block">
          <div className="grid grid-cols-12 items-center rounded-t-sm bg-card px-6 py-4">
            <div className="col-span-3 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Recipient
            </div>
            <div className="col-span-5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Subject line
            </div>
            <div className="col-span-2 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Date sent
            </div>
            <div className="col-span-2 text-right font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Status
            </div>
          </div>

          {slice.length === 0 ? (
            <div className="bg-background px-6 py-16 text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
              No messages in this view. Sent mail from agents and the assistant will appear here.
            </div>
          ) : (
            slice.map((row, i) => (
              <div
                key={`${row.source}-${row.id}`}
                className={cn(
                  "group grid grid-cols-12 items-center px-6 py-5 transition-colors",
                  i % 2 === 0
                    ? "bg-background hover:bg-muted/60 dark:hover:bg-[#131313]"
                    : "bg-muted/30 hover:bg-muted/70 dark:bg-[#131313]/30 dark:hover:bg-[#131313]",
                )}
              >
                <div className="col-span-3">
                  <p className="text-[13px] font-medium text-foreground">{row.recipientName}</p>
                  <p className="text-[11px] text-muted-foreground">{row.recipientEmail}</p>
                </div>
                <div className="col-span-5 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] text-muted-foreground transition-colors group-hover:text-foreground">
                      {row.subject}
                    </p>
                    <EmailDraftViewButton
                      subject={row.subject}
                      body={row.body}
                      buttonClassName="border-[#484848]/30 bg-transparent font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#BD9952] hover:border-[#BD9952]/50 hover:bg-[#BD9952]/5 hover:text-[#BD9952]"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-[12px] font-light text-muted-foreground">
                    {formatSentDate(row.sentAt)}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end">
                  <StatusPill status={row.uiStatus} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-12 flex flex-col gap-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span>
              Page {safePage} of {pageCount}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex size-6 items-center justify-center border border-border text-muted-foreground transition hover:border-secondary/40 hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="flex size-6 items-center justify-center border border-border text-muted-foreground transition hover:border-secondary/40 hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="size-1.5 rounded-full bg-[#afefdd] shadow-[0_0_8px_rgba(175,239,221,0.4)]"
              aria-hidden
            />
            <span className="text-muted-foreground">
              System live:{" "}
              <span className="text-muted-foreground">{totalDispatched.toLocaleString("en-GB")}</span> total
              emails dispatched this cycle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
