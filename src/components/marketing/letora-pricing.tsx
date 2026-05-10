import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

import { PricingPlanSubscribeButton } from "@/components/marketing/pricing-plan-button";
import { cn } from "@/lib/utils";
import { PLANS as STRIPE_PLANS, PLAN_ORDER } from "@/lib/stripe-plans";

const STARTER_FEATURES = STRIPE_PLANS.monthly.features;

export function LetoraPricingSection() {
  const monthly = STRIPE_PLANS.monthly;
  const yearly = STRIPE_PLANS.yearly;

  return (
    <section
      id="pricing"
      className="scroll-mt-24 border-t border-border dark:border-[#4F4632]/10 bg-background dark:bg-[#131313] px-6 py-24 md:px-12 lg:px-24 lg:py-32"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-screen-2xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">
            Pricing
          </p>
          <h2
            id="pricing-heading"
            className="mt-4 font-headline text-4xl font-bold tracking-[-0.04em] text-foreground md:text-5xl lg:text-6xl"
          >
            One plan · Starter
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-[family-name:var(--font-inter)] text-base font-light leading-relaxed text-foreground md:text-lg">
            Pay monthly or yearly (save on annual billing). GBP via our payments partner — prices exclude VAT where
            applicable.
          </p>
          <p className="mt-6 font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1 font-medium text-emerald-500 underline-offset-4 hover:underline"
            >
              Create an account to subscribe
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-lg">
          <article
            className={cn(
              "flex h-full min-w-0 flex-col rounded-2xl border p-8 shadow-[0_24px_64px_rgba(0,0,0,0.35)]",
              "border-emerald-500/30 bg-[linear-gradient(180deg,rgba(27,27,27,0.98)_0%,rgba(19,19,19,0.99)_100%)] ring-1 ring-emerald-500/15 md:p-10",
            )}
          >
            <div className="space-y-2 text-center">
              <h3 className="font-headline text-2xl font-semibold tracking-[-0.03em] text-foreground">Starter</h3>
              <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-snug text-foreground">
                {monthly.tagline}
              </p>
            </div>

            <ul className="mt-8 flex flex-col gap-3">
              {STARTER_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex gap-3 font-[family-name:var(--font-inter)] text-sm font-light leading-snug text-foreground"
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                    <Check className="size-3" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-col gap-4 border-t border-border dark:border-[#4F4632]/15 pt-8">
              <div className="rounded-lg border border-border/60 bg-background/60 p-4 dark:border-[#4F4632]/20">
                <p className="font-headline text-2xl font-bold tabular-nums text-foreground">
                  £{monthly.price}
                  <span className="font-[family-name:var(--font-inter)] text-base font-medium text-muted-foreground">
                    {" "}
                    / month
                  </span>
                </p>
                <div className="mt-4">
                  <PricingPlanSubscribeButton planKey={PLAN_ORDER[0]} highlighted>
                    Start 24h free trial · Monthly
                  </PricingPlanSubscribeButton>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/60 p-4 dark:border-[#4F4632]/20">
                <p className="font-headline text-2xl font-bold tabular-nums text-foreground">
                  £{yearly.price}
                  <span className="font-[family-name:var(--font-inter)] text-base font-medium text-muted-foreground">
                    {" "}
                    / year
                  </span>
                </p>
                {(yearly as { badge?: string }).badge ? (
                  <p className="mt-2 font-[family-name:var(--font-inter)] text-xs text-muted-foreground">
                    {(yearly as { badge?: string }).badge}
                  </p>
                ) : null}
                <div className="mt-4">
                  <PricingPlanSubscribeButton planKey={PLAN_ORDER[1]} highlighted={false}>
                    Start 24h free trial · Yearly
                  </PricingPlanSubscribeButton>
                </div>
              </div>
              <p className="font-[family-name:var(--font-inter)] text-xs leading-snug text-muted-foreground">
                Card required for trial. Cancel before it ends if you don’t want to be charged.
              </p>
            </div>

            <div className="mt-8 border-t border-border dark:border-[#4F4632]/15 pt-8 text-center">
              <p className="font-[family-name:var(--font-inter)] text-xs text-muted-foreground">
                Need procurement, security review, or a bespoke rollout?{" "}
                <Link
                  href="/signup?intent=enterprise"
                  className="font-medium text-emerald-500 underline-offset-4 hover:underline"
                >
                  Talk to sales
                </Link>
              </p>
            </div>
          </article>
        </div>

        <p className="mx-auto mt-12 max-w-2xl text-center font-[family-name:var(--font-inter)] text-xs leading-relaxed text-[#6b6a69]">
          Manage payment method and invoices anytime in{" "}
          <Link href="/dashboard/billing" className="text-muted-foreground underline-offset-4 hover:underline">
            Billing
          </Link>{" "}
          while signed in.
        </p>
      </div>
    </section>
  );
}
