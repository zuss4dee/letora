"use client";

import { ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AddRequestDialog } from "@/components/maintenance/add-request-dialog";
import type { MaintenanceRequestRow } from "@/lib/actions/maintenance";
import { cn } from "@/lib/utils";

type TabId = "all" | "in_progress" | "resolved";

type DotTone = "red" | "gold" | "teal" | "grey" | "muted";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function avgResponseHours(resolved: MaintenanceRequestRow[]): string {
  const samples = resolved
    .filter((r) => r.createdAt && r.resolvedAt)
    .map(
      (r) =>
        (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt!).getTime()) / 3_600_000,
    );
  if (samples.length === 0) return "—";
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  if (avg < 1) return `${Math.round(avg * 60)}m`;
  return `${avg.toFixed(1)}h`;
}

function rowPresentation(row: MaintenanceRequestRow): {
  dot: DotTone;
  statusLabel: string;
  actionLabel: "Manage" | "View" | "Approve" | "History";
  muted: boolean;
  badgeClass: string;
} {
  const st = (row.status ?? "open").toLowerCase();
  if (st === "resolved") {
    return {
      dot: "muted",
      statusLabel: "Closed",
      actionLabel: "History",
      muted: true,
      badgeClass: "text-[#ACABAA]/80",
    };
  }
  if (st === "in_progress") {
    return {
      dot: "gold",
      statusLabel: "In Progress",
      actionLabel: "View",
      muted: false,
      badgeClass: "bg-[#BD9952]/10 text-[#BD9952]",
    };
  }
  const pri = (row.priority ?? "medium").toLowerCase();
  const ai = (row.aiTriageCategory ?? "").toLowerCase();
  if (pri === "urgent" || ai === "urgent-safety") {
    return {
      dot: "red",
      statusLabel: "Reported",
      actionLabel: "Manage",
      muted: false,
      badgeClass: "bg-[#BB5551]/15 text-[#ee7d77]",
    };
  }
  if (ai === "urgent") {
    return {
      dot: "teal",
      statusLabel: "Review Required",
      actionLabel: "Approve",
      muted: false,
      badgeClass: "bg-[#afefdd]/10 text-[#afefdd]",
    };
  }
  if (ai === "routine" || ai === "low-priority") {
    return {
      dot: "grey",
      statusLabel: "Triage",
      actionLabel: "Manage",
      muted: false,
      badgeClass: "bg-[#484848]/40 text-[#ACABAA]",
    };
  }
  if (row.contractorName?.trim()) {
    return {
      dot: "gold",
      statusLabel: "In Progress",
      actionLabel: "View",
      muted: false,
      badgeClass: "bg-[#BD9952]/10 text-[#BD9952]",
    };
  }
  return {
    dot: "red",
    statusLabel: "Reported",
    actionLabel: "Manage",
    muted: false,
    badgeClass: "bg-[#BB5551]/15 text-[#ee7d77]",
  };
}

function StatusDot({ tone }: { tone: DotTone }) {
  const cls: Record<DotTone, string> = {
    red: "bg-[#ee7d77] shadow-[0_0_8px_rgba(238,125,119,0.35)]",
    gold: "bg-[#BD9952] shadow-[0_0_8px_rgba(189,153,82,0.35)]",
    teal: "bg-[#afefdd] shadow-[0_0_8px_rgba(175,239,221,0.35)]",
    grey: "bg-[#767575]",
    muted: "bg-[#767575]/35",
  };
  return <div className={cn("size-2 shrink-0 rounded-full", cls[tone])} aria-hidden />;
}

function titleFromDescription(desc: string | null, fallback: string) {
  if (!desc?.trim()) return fallback;
  const line = desc.split("\n")[0]?.trim() ?? "";
  if (line.length <= 90) return line;
  return `${line.slice(0, 87)}…`;
}

export function MaintenanceRegistry({
  open: openRows,
  resolved: resolvedRows,
  tenancies,
}: {
  open: MaintenanceRequestRow[];
  resolved: MaintenanceRequestRow[];
  tenancies: Array<{ id: string; label: string }>;
}) {
  const [tab, setTab] = useState<TabId>("all");
  const [showHistory, setShowHistory] = useState(false);

  const activeIssues = openRows.length;
  const criticalAlerts = openRows.filter(
    (r) => (r.priority ?? "").toLowerCase() === "urgent",
  ).length;
  const responseAvg = avgResponseHours(resolvedRows);

  const insightProperty = useMemo(() => {
    const pick = openRows[0] ?? resolvedRows[0];
    const addr = pick?.propertyAddress?.split(",")[0]?.trim();
    return addr || "your portfolio";
  }, [openRows, resolvedRows]);

  const sortedOpen = useMemo(
    () => [...openRows].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
    [openRows],
  );
  const sortedResolved = useMemo(
    () => [...resolvedRows].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
    [resolvedRows],
  );

  const queueRows = useMemo(() => {
    if (tab === "in_progress") {
      return sortedOpen.filter((r) => (r.status ?? "").toLowerCase() === "in_progress");
    }
    if (tab === "resolved") {
      return sortedResolved;
    }
    // all: open first, then optionally resolved
    if (showHistory) {
      return [...sortedOpen, ...sortedResolved].sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      );
    }
    return sortedOpen;
  }, [tab, sortedOpen, sortedResolved, showHistory]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "all", label: "All Requests" },
    { id: "in_progress", label: "In Progress" },
    { id: "resolved", label: "Resolved" },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#0E0E0E]">
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 pb-20 pt-6 md:px-12 md:pt-8">
        <div className="flex flex-col gap-6 border-b border-[#484848]/15 pb-8 md:flex-row md:items-center md:justify-between">
          <p className="max-w-xl font-[family-name:var(--font-inter)] text-sm text-[#ACABAA]">
            Track issues, triage with AI, and keep every property within SLA. Use the queue below to manage
            work in real time.
          </p>
          <AddRequestDialog
            tenancies={tenancies}
            trigger={
              <button
                type="button"
                disabled={tenancies.length === 0}
                className="inline-flex items-center gap-3 bg-[#BD9952] px-8 py-2.5 font-[family-name:var(--font-inter)] text-[0.625rem] font-bold uppercase tracking-[0.15em] text-[#2c1e00] transition-colors hover:bg-[#A38245] disabled:opacity-40"
              >
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                Raise Request
              </button>
            }
          />
        </div>

        <div className="mb-12 grid grid-cols-2 gap-8 border-b border-[#484848]/10 pb-10 pt-10 md:grid-cols-4 md:gap-12">
          <div>
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA]">
              Active Issues
            </p>
            <p className="font-headline mt-1 text-2xl font-extralight tabular-nums text-[#E7E5E4]">
              {String(activeIssues).padStart(2, "0")}
            </p>
          </div>
          <div>
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA]">
              Response Avg
            </p>
            <p className="font-headline mt-1 text-2xl font-extralight tabular-nums text-[#E7E5E4]">
              {responseAvg}
            </p>
          </div>
          <div>
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA]">
              Network
            </p>
            <p className="font-headline mt-1 text-2xl font-extralight tabular-nums text-[#BD9952]">
              99.9%
            </p>
          </div>
          <div>
            <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA]">
              Critical Alerts
            </p>
            <p
              className={cn(
                "font-headline mt-1 text-2xl font-extralight tabular-nums",
                criticalAlerts > 0 ? "text-[#BB5551]" : "text-[#E7E5E4]",
              )}
            >
              {String(criticalAlerts).padStart(2, "0")}
            </p>
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.2em] text-[#ACABAA]">
            Maintenance Queue
          </h2>
          <div className="flex flex-wrap gap-6 font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  if (t.id !== "all") setShowHistory(false);
                }}
                className={cn(
                  "transition-colors",
                  tab === t.id
                    ? "text-[#E7E5E4]"
                    : "text-[#ACABAA]/50 hover:text-[#BD9952]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          {tab === "all" &&
          !showHistory &&
          sortedOpen.length === 0 &&
          resolvedRows.length > 0 ? (
            <div className="border border-[#484848]/10 bg-black/40 px-6 py-14 text-center">
              <p className="font-[family-name:var(--font-inter)] text-sm text-[#ACABAA]">
                No active maintenance requests.
              </p>
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="mt-4 font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#BD9952] hover:underline"
              >
                Show historical records ({resolvedRows.length})
              </button>
            </div>
          ) : queueRows.length === 0 ? (
            <div className="border border-[#484848]/10 bg-black/40 px-6 py-16 text-center font-[family-name:var(--font-inter)] text-sm text-[#ACABAA]">
              No maintenance requests in this view.
            </div>
          ) : (
            queueRows.map((row) => {
              const pres = rowPresentation(row);
              const title = titleFromDescription(row.description, "Maintenance request");
              const sub = [row.propertyAddress, row.tenantFullName].filter(Boolean).join(" • ");
              const metaPrimary = formatRelativeTime(row.createdAt);
              const metaSecondary = row.contractorName?.trim()
                ? `${row.contractorName} · Assigned`
                : row.tenantFullName
                  ? `${row.tenantFullName} · Intake`
                  : "Raised via workspace";

              return (
                <div
                  key={row.id}
                  className={cn(
                    "group flex flex-col gap-4 border border-[#484848]/10 bg-black/50 p-6 transition-all hover:bg-[#252626]/35 sm:flex-row sm:items-center sm:justify-between",
                    pres.muted && "opacity-50",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-6">
                    <StatusDot tone={pres.dot} />
                    <div className="min-w-0">
                      <h3 className="font-headline text-[0.9375rem] font-light text-[#E7E5E4] transition-colors group-hover:text-white">
                        {title}
                      </h3>
                      <p className="mt-0.5 font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#ACABAA]">
                        {sub || "Property · Tenant"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-12">
                    <div className="text-left sm:text-right">
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 font-[family-name:var(--font-inter)] text-[9px] uppercase tracking-[0.2em]",
                          pres.statusLabel === "Closed"
                            ? "text-[#ACABAA]/70"
                            : pres.badgeClass,
                        )}
                      >
                        {pres.statusLabel}
                      </span>
                      <p className="mt-1.5 font-[family-name:var(--font-inter)] text-[9px] uppercase tracking-tight text-[#ACABAA]">
                        {metaPrimary}
                      </p>
                      <p className="mt-0.5 font-[family-name:var(--font-inter)] text-[9px] text-[#ACABAA]/80">
                        {metaSecondary}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/maintenance/${row.id}`}
                      className="inline-flex shrink-0 items-center justify-center border border-[#484848]/25 px-6 py-2 font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#C9C6C5] transition-all hover:border-[#BD9952] hover:text-[#BD9952]"
                    >
                      {pres.actionLabel}
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {tab === "all" && resolvedRows.length > 0 && !showHistory ? (
          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA] transition-colors hover:text-[#BD9952]"
            >
              Show Historical Records
              <ChevronDown className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}

        {tab === "all" && showHistory && resolvedRows.length > 0 ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA] hover:text-[#BD9952]"
            >
              Hide historical records
            </button>
          </div>
        ) : null}

        <div className="mt-24 flex flex-col gap-8 border border-[#484848]/15 bg-[#131313]/40 p-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="mt-1 size-1.5 shrink-0 animate-pulse rounded-full bg-[#BD9952] shadow-[0_0_10px_#BD9952]"
              aria-hidden
            />
            <div className="max-w-2xl">
              <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-[0.2em] text-[#ACABAA]">
                Letora AI Canvas Insight
              </p>
              <p className="mt-2 font-headline text-sm font-light leading-relaxed text-[#E7E5E4]">
                Analyzing historical logs. Predicted trend: HVAC and plumbing workloads near{" "}
                <span className="font-medium text-[#BD9952]">{insightProperty}</span> may rise with seasonal load.
                Consider scheduling a preventative walkthrough.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              className="bg-[#C9C6C5]/10 px-6 py-2 font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#E7E5E4] transition-colors hover:bg-[#C9C6C5]/20"
            >
              Schedule Check
            </button>
            <button
              type="button"
              className="border border-[#484848]/15 px-6 py-2 font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#ACABAA] transition-colors hover:border-[#484848]/35"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
