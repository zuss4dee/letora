"use client";

import { useLayoutEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

export type StripeCheckoutBannerKind = "success" | "cancelled" | "unknown";

export type StripeCheckoutBannerPayload = {
  kind: StripeCheckoutBannerKind;
  sessionTail: string | null;
  paymentId: string | null;
};

function classifyPaymentParam(raw: string | null): StripeCheckoutBannerKind {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "success") return "success";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s.length === 0) return "unknown";
  return "unknown";
}

function tailSession(id: string | null): string | null {
  if (!id?.trim()) return null;
  const v = id.trim();
  return v.length <= 10 ? v : `…${v.slice(-10)}`;
}

/**
 * Reads `payment=` / `session_id` once from the URL (Stripe return), surfaces a contextual strip,
 * then strips those keys via `history.replaceState` so refresh does not replay the toast.
 */
export function RentTrackerCheckoutReturnBanner({ className }: { className?: string }) {
  const [banner, setBanner] = useState<StripeCheckoutBannerPayload | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const url = new URL(window.location.href);
      const rawStatus = url.searchParams.get("payment");
      const sessionId = url.searchParams.get("session_id");
      const scopedPaymentId = url.searchParams.get("paymentId");

      if (!rawStatus) return;

      const kind = classifyPaymentParam(rawStatus);
      // One-shot hydration from window.location; must run after mount to read query + strip params.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync read/replaceState is intentional here
      setBanner({
        kind,
        sessionTail: tailSession(sessionId),
        paymentId: scopedPaymentId?.trim() || null,
      });

      url.searchParams.delete("payment");
      url.searchParams.delete("session_id");
      const qs = url.searchParams.toString();
      const path = qs.length > 0 ? `${url.pathname}?${qs}` : url.pathname;
      window.history.replaceState({}, "", `${path}${url.hash}`);
    } catch {
      /* ignore malformed URLs */
    }
  }, []);

  if (!banner) return null;

  const title =
    banner.kind === "success"
      ? "Rent checkout succeeded"
      : banner.kind === "cancelled"
        ? "Rent checkout cancelled"
        : "Checkout return unclear";

  const body =
    banner.kind === "success"
      ? "Stripe captured the payment. Your instalment will move to Paid after Letora receives Stripe’s webhook (usually within a minute)."
      : banner.kind === "cancelled"
        ? "No charge was made. Pick the instalment below if you’d like to try again."
        : "We could not read a clear success or cancel state from Stripe’s return URL.";

  const success = banner.kind === "success";
  const cancel = banner.kind === "cancelled";

  const metaChunks: string[] = [];
  if (banner.paymentId) metaChunks.push(`Instalment context preserved`);
  if (banner.kind === "success" && banner.sessionTail)
    metaChunks.push(`Stripe session ${banner.sessionTail}`);

  return (
    <aside
      role="status"
      className={cn(
        "shrink-0 border-b px-4 py-3 font-['Inter',system-ui,sans-serif] md:px-6",
        success
          ? "border-emerald-200 bg-emerald-50 dark:border-[#282828] dark:bg-[#152420]"
          : cancel
            ? "border-zinc-200 bg-zinc-100 dark:border-[#282828] dark:bg-[#161616]"
            : "border-amber-200 bg-amber-50 dark:border-[#282828] dark:bg-[#1a1612]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        {success ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-[#afefdd]" aria-hidden />
        ) : (
          <AlertTriangle
            className={cn(
              "mt-0.5 size-4 shrink-0",
              cancel ? "text-zinc-500" : "text-amber-500/90",
            )}
            aria-hidden
          />
        )}
        <div className="min-w-0 space-y-1">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.12em]",
              success ? "text-emerald-900 dark:text-[#afefdd]" : "text-zinc-900 dark:text-white",
            )}
          >
            {title}
          </p>
          <p className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.06em] text-zinc-600 dark:text-zinc-400">
            {body}
          </p>
          {metaChunks.length > 0 ? (
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-600 dark:text-zinc-500">
              {metaChunks.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
