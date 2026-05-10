import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

import { PricingPlanLinkCta, PricingPlanSubscribeButton } from "@/components/marketing/pricing-plan-button";
import { cn } from "@/lib/utils";
import { PLAN_ORDER, PLANS as STRIPE_PLANS, type PlanKey } from "@/lib/stripe-plans";

type MarketingTier = {
  key: PlanKey | "enterprise";
  name: string;
  tagline: string;
  price: string;
  priceSuffix: string;
  footnote?: string;
  badge?: string;
  features: readonly string[];
  cta: string;
  /** Enterprise only — Stripe tiers use checkout button */
  href?: string;
  highlighted?: boolean;
};

function buildStripeTiers(): MarketingTier[] {
  return PLAN_ORDER.map((key) => {
    const p = STRIPE_PLANS[key];
    const cta = "Start 24h Free Trial";
    const badge = (p as any).badge;
    const priceSuffix = key === "yearly" ? "/ year" : "/ month";
    
    return {
      key,
      name: p.name,
      tagline: p.tagline,
      price: `£${p.price}`,
      priceSuffix,
      badge,
      features: p.features,
      cta,
      highlighted: p.highlighted,
    };
  });
}

const ENTERPRISE_TIER: Omit<MarketingTier, "key"> = {
  name: "Enterprise",
  tagline: "Procurement, security reviews, and bespoke rollout",
  price: "Custom",
  priceSuffix: "",
  footnote: "Minimums and annual agreements typical. We scope SLAs and integrations with your team.",
  features: [
    "Volume pricing and MSAs",
    "Security questionnaire and data handling alignment",
    "Custom integrations and onboarding",
    "Named success contact",
    "Uptime and support terms to match your needs",
  ],
  cta: "Talk to sales",
  href: "/signup?intent=enterprise",
};

export function LetoraPricingSection() {
  const stripeTiers = buildStripeTiers();
  const allTiers: MarketingTier[] = [...stripeTiers, { key: "enterprise" as const, ...ENTERPRISE_TIER }];

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
            Plans that scale with your portfolio
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-[family-name:var(--font-inter)] text-base font-light leading-relaxed text-foreground md:text-lg">
            Select the billing cycle that fits your operations. Self-serve plans bill in
            GBP through our secure partner. Prices exclude VAT where applicable.
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

        <div
          id="pricing-plans"
          className="mt-16 grid min-w-0 scroll-mt-28 grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
        >
          {allTiers.map((plan) => (
            <article
              key={plan.key}
              className={cn(
                "flex h-full min-w-0 flex-col rounded-2xl border p-6 shadow-[0_24px_64px_rgba(0,0,0,0.35)] md:p-7",
                plan.highlighted
                  ? "border-emerald-500/30 bg-[linear-gradient(180deg,rgba(27,27,27,0.98)_0%,rgba(19,19,19,0.99)_100%)] ring-1 ring-emerald-500/15"
                  : "border-zinc-800 bg-background dark:bg-[#161616]/90",
              )}
            >
              <div className="space-y-2">
                <div className="flex min-h-[1.5rem] items-center">
                  {plan.badge ? (
                    <span className="inline-flex w-fit rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-500">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="font-headline text-xl font-semibold tracking-[-0.03em] text-foreground">{plan.name}</h3>
                <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-snug text-foreground">
                  {plan.tagline}
                </p>
              </div>

              <ul className="mt-6 flex flex-1 flex-col gap-3">
                {plan.features.map((f) => (
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

              <div className="mt-5 min-h-[2.75rem]">
                {plan.footnote ? (
                  <p className="font-[family-name:var(--font-inter)] text-xs italic leading-relaxed text-muted-foreground">
                    {plan.footnote}
                  </p>
                ) : null}
              </div>

              <div className="mt-auto border-t border-border dark:border-[#4F4632]/15 pt-6">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-headline text-3xl font-bold tabular-nums tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  {plan.priceSuffix ? (
                    <span className="font-[family-name:var(--font-inter)] text-sm font-medium text-muted-foreground">
                      {plan.priceSuffix}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5">
                  {plan.key === "enterprise" ? (
                    <PricingPlanLinkCta href={plan.href ?? "/signup?intent=enterprise"} highlighted={plan.highlighted}>
                      {plan.cta}
                    </PricingPlanLinkCta>
                  ) : (
                    <div className="space-y-2">
                      <PricingPlanSubscribeButton planKey={plan.key} highlighted={plan.highlighted}>
                        {plan.cta}
                      </PricingPlanSubscribeButton>
                      <p className="font-[family-name:var(--font-inter)] text-xs leading-snug text-muted-foreground">
                        Card required. Cancel anytime before trial ends to avoid charges.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-12 max-w-2xl text-center font-[family-name:var(--font-inter)] text-xs leading-relaxed text-[#6b6a69]">
          Need to change plan or payment method after signup? Open{" "}
          <Link href="/dashboard/billing" className="text-muted-foreground underline-offset-4 hover:underline">
            Billing
          </Link>{" "}
          in the dashboard while signed in. Enterprise buyers can start from signup and we will follow up on larger
          requirements.
        </p>
      </div>
    </section>
  );
}
