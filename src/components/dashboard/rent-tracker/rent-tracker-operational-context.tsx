import Link from "next/link";

import { AlertTriangle, Filter } from "lucide-react";
import {
  type RentTrackerResolvedDisplayMode,
  RENT_TRACKER_MODE_OPERATOR_LABELS,
} from "@/lib/rent-tracker-url-mode";
import { cn } from "@/lib/utils";

type RentTrackerOperationalContextProps = {
  /** True when user arrived from Command Center queue (payment / tenancy context). */
  showQueueBacktrail: boolean;
  requestedPaymentMissing: boolean;
  requestedTenancyMissing: boolean;
  requestedTenantMissing: boolean;
  paymentTenantContextConflict: boolean;
  tenancyTenantContextConflict: boolean;
  usedFullListFallback: boolean;
  /** Canonical `mode` applied to the instalment roster (defaults to `all`). */
  resolvedRentTrackerMode?: RentTrackerResolvedDisplayMode;
  unknownRentTrackerModeDropped?: boolean;
  /** Scoped `paymentId` row was folded into view even though it does not satisfy the active mode filter. */
  rentTrackerModePausedForFocus?: boolean;
  /** Hide KPI mode ribbon when it duplicates instalment-queue context (`paymentId` + arrears drill). */
  suppressRentTrackerModeRibbon?: boolean;
};

/**
 * Server-rendered contextual chrome for Rent Tracker deeplinks.
 * Matches Command Center operational language (#0B0B0B, hard borders, mono labels).
 */
export function RentTrackerOperationalContextStrip({
  showQueueBacktrail,
  requestedPaymentMissing,
  requestedTenancyMissing,
  requestedTenantMissing,
  paymentTenantContextConflict,
  tenancyTenantContextConflict,
  usedFullListFallback,
  resolvedRentTrackerMode = "all",
  unknownRentTrackerModeDropped = false,
  rentTrackerModePausedForFocus = false,
  suppressRentTrackerModeRibbon = false,
}: RentTrackerOperationalContextProps) {
  const showMismatchStrip =
    requestedPaymentMissing ||
    requestedTenancyMissing ||
    requestedTenantMissing ||
    paymentTenantContextConflict ||
    tenancyTenantContextConflict ||
    usedFullListFallback;

  const showActiveRentModeRibbon =
    resolvedRentTrackerMode !== "all" && !unknownRentTrackerModeDropped && !suppressRentTrackerModeRibbon;

  if (!showQueueBacktrail && !showMismatchStrip && !showActiveRentModeRibbon && !unknownRentTrackerModeDropped) {
    return null;
  }

  const mismatchTitle = requestedPaymentMissing
    ? "Payment reference unresolved"
    : tenancyTenantContextConflict
      ? "Tenant and tenancy mismatch"
      : paymentTenantContextConflict
        ? "Tenant does not match this payment"
        : requestedTenancyMissing
          ? "Tenancy reference unresolved"
          : requestedTenantMissing
            ? "Tenant scope unavailable"
            : usedFullListFallback
              ? "Full tracker restored"
              : "";

  const mismatchBody = requestedPaymentMissing
    ? "The URL pointed at a rent row we cannot resolve. Every rent payment is listed below."
    : tenancyTenantContextConflict
      ? "The tenancy id and tenant id in the URL disagree. Showing every rent instalment instead."
      : paymentTenantContextConflict
        ? "The URL named a tenant that does not sit on this payment — the payment’s tenancy is shown so you stay on the arrears instalment."
        : requestedTenancyMissing
          ? "The tenancy scope could not be matched to your organisation. Showing the full rent roster."
          : requestedTenantMissing
            ? "No active tenancy belongs to this tenant on your account (or none include rent ledger rows). Showing the full rent roster."
            : usedFullListFallback
              ? "Filtering produced no visible cases — the full roster is restored so Rent Operations never blanks."
              : "";

  const destructiveMismatch = requestedPaymentMissing;

  const modeOperatorLabel =
    resolvedRentTrackerMode !== "all" ? RENT_TRACKER_MODE_OPERATOR_LABELS[resolvedRentTrackerMode] : "";

  return (
    <div className="shrink-0 space-y-0 border-b border-zinc-200 font-['Inter',system-ui,sans-serif] dark:border-[#282828]">
      {unknownRentTrackerModeDropped ? (
        <div role="status" className="flex flex-wrap items-start gap-2 bg-amber-50 px-4 py-3 dark:bg-[#1a1612] md:px-6">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600/90 dark:text-amber-500/90" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-950 dark:text-white">
              Rent filter not recognised
            </p>
            <p className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.06em] text-zinc-600 dark:text-zinc-500">
              The URL named a rental view we do not support — showing every scoped instalment while you stay oriented.
            </p>
          </div>
        </div>
      ) : null}

      {showActiveRentModeRibbon ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-emerald-50 px-4 py-3 dark:bg-[#101910] md:px-6">
          <Filter className="size-3.5 shrink-0 text-emerald-700/90 dark:text-[#afefdd]/80" aria-hidden />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-900 dark:text-[#afefdd]">
            Active view · {modeOperatorLabel}
          </span>
          {rentTrackerModePausedForFocus ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-700/90 dark:text-amber-400/90">
              Instalment focus keeps a row outside this filter visible.
            </span>
          ) : null}
        </div>
      ) : null}

      {showQueueBacktrail ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-zinc-100 px-4 py-3 dark:bg-[#141414] md:px-6">
          <span className="size-1.5 shrink-0 bg-background dark:bg-[#ffb4ab]" aria-hidden />
          <Link
            href="/dashboard"
            aria-label="Back to Command Center"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-800 underline-offset-4 transition-colors hover:text-zinc-950 hover:underline dark:text-[#e5e2e1] dark:hover:text-white"
          >
            ← Command Center
          </Link>
          <span className="hidden h-3 w-px bg-zinc-300 sm:block dark:bg-[#333333]" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-500">
            Rent operations / overdue case
          </span>
        </div>
      ) : null}

      {showMismatchStrip ? (
        <div
          role="status"
          className={cn(
            "flex flex-wrap items-start gap-2 px-4 py-3 md:px-6",
            destructiveMismatch ? "bg-red-100/90 dark:bg-[#93000a]/15" : "bg-amber-50 dark:bg-[#1a1612]",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 size-4 shrink-0",
              destructiveMismatch ? "text-red-600 dark:text-[#ffb4ab]" : "text-amber-600/90 dark:text-amber-500/90",
            )}
            aria-hidden
          />
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-900 dark:text-white">{mismatchTitle}</p>
            {mismatchBody ? (
              <p className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.06em] text-zinc-600 dark:text-zinc-500">
                {mismatchBody}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
