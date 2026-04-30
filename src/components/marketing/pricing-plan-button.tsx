"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { PLANS, type PlanKey } from "@/lib/stripe-plans";
import { POLAR_PLANS } from "@/lib/polar-plans";
import type { CheckoutReturnTarget } from "@/lib/stripe/checkout-return-target";

type Props = {
  planKey: PlanKey;
  highlighted?: boolean;
  children: ReactNode;
  /** Where Stripe should send the user after pay / cancel (Billing page vs marketing Pricing). */
  checkoutReturnTarget?: CheckoutReturnTarget;
};

/**
 * Logged-out: links to signup with plan query.
 * Logged-in: POSTs to platform checkout and redirects to Stripe.
 */
export function PricingPlanSubscribeButton({
  planKey,
  highlighted,
  children,
  checkoutReturnTarget = "default",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        window.location.href = `/signup?plan=${planKey}`;
        return;
      }

      // Monthly and Yearly are Polar plans. Legacy plans (starter/pro/landlord_pro) use Stripe.
      const isPolarPlan = planKey === "monthly" || planKey === "yearly";

      if (isPolarPlan) {
        const priceId = POLAR_PLANS[planKey].priceId?.trim();
        if (!priceId) {
          setError("Billing is not configured. Please try again later.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/polar/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceId, plan: planKey }),
        });

        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not start checkout. Please try again.");
          setLoading(false);
          return;
        }
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      } else {
        // Legacy Stripe path (for existing subscribers only)
        const priceId = PLANS[planKey].priceId?.trim();
        if (!priceId) {
          setError("Billing is not configured. Please try again later.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceId, plan: planKey, returnTarget: checkoutReturnTarget }),
        });

        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not start checkout. Please try again.");
          setLoading(false);
          return;
        }
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      setError("No checkout URL returned.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={loading}
        onClick={() => void startCheckout()}
        className={cn(
          "group inline-flex w-full items-center justify-center gap-2 rounded-full py-3 pl-5 pr-4 text-sm font-semibold transition-all disabled:opacity-70",
          highlighted
            ? "bg-gradient-to-br from-[#FFEABB] to-[#FFC800] text-[#3e2e00] shadow-[0_0_32px_-8px_rgba(255,234,187,0.4)] hover:shadow-[0_0_40px_-6px_rgba(255,234,187,0.55)]"
            : "border border-[#BD9952]/35 bg-card text-foreground hover:border-[#BD9952]/55 hover:bg-muted dark:border-[#4F4632]/35 dark:bg-[#1a1a1a] dark:hover:border-[#4F4632]/55 dark:hover:bg-[#222]",
        )}
      >
        {loading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
        <span>{children}</span>
        {!loading ? (
          <ArrowUpRight
            className={cn(
              "size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
              highlighted ? "text-[#3e2e00]" : "text-foreground",
            )}
            aria-hidden
          />
        ) : null}
      </button>
      {error ? (
        <p className="mt-2 text-center font-[family-name:var(--font-inter)] text-xs text-red-600 dark:text-red-400/90">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Enterprise and other link-only CTAs (no Stripe checkout). */
export function PricingPlanLinkCta({
  href,
  highlighted,
  children,
}: {
  href: string;
  highlighted?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex w-full items-center justify-center gap-2 rounded-full py-3 pl-5 pr-4 text-sm font-semibold transition-all",
        highlighted
          ? "bg-gradient-to-br from-[#FFEABB] to-[#FFC800] text-[#3e2e00] shadow-[0_0_32px_-8px_rgba(255,234,187,0.4)] hover:shadow-[0_0_40px_-6px_rgba(255,234,187,0.55)]"
          : "border border-[#BD9952]/35 bg-card text-foreground hover:border-[#BD9952]/55 hover:bg-muted dark:border-[#4F4632]/35 dark:bg-[#1a1a1a] dark:hover:border-[#4F4632]/55 dark:hover:bg-[#222]",
      )}
    >
      <span>{children}</span>
      <ArrowUpRight
        className={cn(
          "size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
          highlighted ? "text-[#3e2e00]" : "text-foreground",
        )}
        aria-hidden
      />
    </Link>
  );
}
