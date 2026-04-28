"use client";

import { PricingPlanSubscribeButton } from "@/components/marketing/pricing-plan-button";
import { cn } from "@/lib/utils";
import type { CheckoutReturnTarget } from "@/lib/stripe/checkout-return-target";
import { PLAN_ORDER, PLANS } from "@/lib/stripe-plans";

/**
 * In-app subscribe — Monthly or Yearly via Polar Checkout.
 */
export function BillingPlanOptions({
  checkoutReturnTarget = "billing",
}: {
  /** Use `onboarding` during first-run wizard so Stripe returns to `/onboarding`. */
  checkoutReturnTarget?: CheckoutReturnTarget;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PLAN_ORDER.map((key) => {
        const p = PLANS[key];
        return (
          <div
            key={key}
            className={cn(
              "flex flex-col rounded-xl border p-5 shadow-sm",
              p.highlighted
                ? "border-zinc-500 bg-zinc-50 ring-1 ring-zinc-500/20 dark:border-white/50 dark:bg-[linear-gradient(180deg,rgba(27,27,27,0.98)_0%,rgba(19,19,19,0.99)_100%)] dark:ring-white/20 dark:shadow-[0_0_40px_-12px_rgba(255,255,255,0.1)]"
                : "border-border bg-card dark:border-zinc-800 dark:bg-[#161616]/80 dark:shadow-none",
            )}
          >
            <div className="mb-4 space-y-1">
              <h3 className="font-headline text-lg font-semibold tracking-tight text-foreground">{p.name}</h3>
              <p className="font-headline text-2xl font-bold tabular-nums text-foreground">
                £{p.price}
                <span className="font-[family-name:var(--font-inter)] text-sm font-medium text-muted-foreground">
                  {" "}
                  / {key === "yearly" ? "year" : "month"}
                </span>
              </p>
              <p className="font-[family-name:var(--font-inter)] text-xs leading-snug text-muted-foreground">
                {p.tagline}
              </p>
            </div>
            <div className="mt-auto pt-2">
              <PricingPlanSubscribeButton planKey={key} highlighted={p.highlighted} checkoutReturnTarget={checkoutReturnTarget}>
                Start trial & add payment
              </PricingPlanSubscribeButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}
