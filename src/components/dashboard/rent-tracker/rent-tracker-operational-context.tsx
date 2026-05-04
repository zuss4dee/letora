import Link from "next/link";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type RentTrackerOperationalContextProps = {
  /** True when user arrived from Command Center queue (payment / tenancy context). */
  showQueueBacktrail: boolean;
  requestedPaymentMissing: boolean;
  requestedTenancyMissing: boolean;
  usedFullListFallback: boolean;
};

/**
 * Server-rendered contextual chrome for Rent Tracker deeplinks.
 * Matches Command Center operational language (#0B0B0B, hard borders, mono labels).
 */
export function RentTrackerOperationalContextStrip({
  showQueueBacktrail,
  requestedPaymentMissing,
  requestedTenancyMissing,
  usedFullListFallback,
}: RentTrackerOperationalContextProps) {
  const showMismatchStrip =
    requestedPaymentMissing || requestedTenancyMissing || usedFullListFallback;

  if (!showQueueBacktrail && !showMismatchStrip) return null;

  const mismatchTitle =
    requestedPaymentMissing
      ? "Payment reference unresolved"
      : requestedTenancyMissing
        ? "Tenancy reference unresolved"
        : "Full tracker restored";

  const mismatchBody =
    requestedPaymentMissing
      ? "The URL pointed at a rent row we cannot resolve. Every rent payment is listed below."
      : requestedTenancyMissing
        ? "The tenancy scope could not be matched to your organisation. Showing the full rent roster."
        : usedFullListFallback
          ? "Filtering produced no visible cases — the full roster is restored so Rent Operations never blanks."
          : "";

  return (
    <div className="shrink-0 space-y-0 border-b border-[#282828] font-['Inter',system-ui,sans-serif]">
      {showQueueBacktrail ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-[#141414] px-4 py-3 md:px-6">
          <span className="size-1.5 shrink-0 bg-[#ffb4ab]" aria-hidden />
          <Link
            href="/dashboard"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#e5e2e1] underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            ← Command Center
          </Link>
          <span className="hidden h-3 w-px bg-[#333333] sm:block" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
            Rent operations / overdue case
          </span>
        </div>
      ) : null}

      {showMismatchStrip ? (
        <div
          role="status"
          className={cn(
            "flex flex-wrap items-start gap-2 px-4 py-3 md:px-6",
            requestedPaymentMissing ? "bg-[#93000a]/15" : "bg-[#1a1612]",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 size-4 shrink-0",
              requestedPaymentMissing ? "text-[#ffb4ab]" : "text-amber-500/90",
            )}
            aria-hidden
          />
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white">{mismatchTitle}</p>
            {mismatchBody ? (
              <p className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.06em] text-zinc-500">
                {mismatchBody}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
