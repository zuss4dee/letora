"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ChevronRight, Clock } from "lucide-react";

import type { ArrearsQueueRow, LateRentCommandCenterState } from "@/lib/dashboard/command-center-queries";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE = 10;

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function formatShortIso(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function arrearsRowHref(row: ArrearsQueueRow): string {
  const params = new URLSearchParams();
  params.set("mode", "arrears");
  params.set("paymentId", row.rentPaymentId);
  if (row.tenancyId) params.set("tenancyId", row.tenancyId);
  if (row.tenantId) params.set("tenantId", row.tenantId);
  return `/dashboard/rent-tracker?${params.toString()}`;
}

function LateRentArrearsRibbon({ row }: { row: ArrearsQueueRow }) {
  const approvalsHref = row.pendingApprovalId
    ? `/dashboard/approvals?id=${encodeURIComponent(row.pendingApprovalId)}`
    : "/dashboard/approvals";

  const config: Record<
    LateRentCommandCenterState,
    { label: string; className: string; wrapWithApprovalsLink: boolean }
  > = {
    chase_pending: {
      label: "CHASE PENDING",
      className:
        "border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-400",
      wrapWithApprovalsLink: true,
    },
    awaiting_agent: {
      label: "AWAITING AGENT",
      className:
        "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
      wrapWithApprovalsLink: false,
    },
    chased: {
      label: "CHASED",
      className:
        "border border-green-200 bg-green-100 text-green-800 dark:border-emerald-800/40 dark:bg-[#152420] dark:text-[#9ad7c3]",
      wrapWithApprovalsLink: false,
    },
    no_action: {
      label: "NO ACTION",
      className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-500",
      wrapWithApprovalsLink: false,
    },
  };

  const c = config[row.lateRentUiState];

  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        c.className,
      )}
    >
      {row.lateRentUiState === "chase_pending" ? <Clock className="size-3 shrink-0 opacity-90" aria-hidden /> : null}
      {c.label}
    </span>
  );

  if (c.wrapWithApprovalsLink) {
    return (
      <Link
        href={approvalsHref}
        className="inline-flex shrink-0"
        aria-label="Open approvals queue"
        title="Open approvals"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

export function CommandCenterArrearsQueueList({ rows }: { rows: ArrearsQueueRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const overflow = rows.length > INITIAL_VISIBLE;
  const visible = showAll || !overflow ? rows : rows.slice(0, INITIAL_VISIBLE);

  return (
    <>
      <div className="divide-y divide-zinc-200 dark:divide-[#282828]">
        {visible.map((row) => (
          <div
            key={row.rentPaymentId}
            className="group flex min-h-[4.5rem] items-center justify-between gap-3 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-[#242424]"
          >
            <Link
              href={arrearsRowHref(row)}
              aria-label={`Open late rent details for ${row.tenantName}`}
              className="flex min-w-0 flex-1 items-center gap-4"
            >
              <div className="flex size-8 shrink-0 items-center justify-center bg-zinc-100 text-red-600 dark:bg-zinc-900 dark:text-[#ffb4ab]">
                <AlertCircle className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-zinc-900 dark:text-white">{row.tenantName}</p>
                <p className="truncate font-mono text-[10px] uppercase text-zinc-500">{row.propertyAddress}</p>
                <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-wide text-zinc-500 dark:text-zinc-600">
                  Instalment due {formatShortIso(row.dueDate)}
                  {row.lateRentUiState === "chase_pending" ? " · reminder waiting for your OK" : ""}
                </p>
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-4 sm:gap-6">
              <div className="hidden text-right sm:block">
                <p className="text-[13px] font-bold tabular-nums text-zinc-900 dark:text-white">{formatMoney(row.amountDue)}</p>
                <p className="font-mono text-[9px] uppercase text-zinc-500">{row.daysOverdue} days late</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <LateRentArrearsRibbon row={row} />
                <Link
                  href={arrearsRowHref(row)}
                  aria-label={`Open late rent details for ${row.tenantName}`}
                  className="text-zinc-400 transition-colors group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-white"
                >
                  <ChevronRight className="size-4 shrink-0" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      {overflow && !showAll ? (
        <div className="border-t border-zinc-200 p-3 text-center dark:border-[#282828]">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-600 underline-offset-4 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Show all {rows.length} overdue instalments
          </button>
        </div>
      ) : null}
    </>
  );
}
