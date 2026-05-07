import Link from "next/link";

import type { UserSettingsRow } from "@/lib/actions/user-settings";
import { formatSubscriptionDate } from "@/lib/billing/subscription-display";
import { FREE_WORKSPACE_PROPERTY_CAP, isPayingPlatformSubscription, planDisplayToKey } from "@/lib/plan-limits";
import { PLANS } from "@/lib/stripe-plans";

export function CurrentPlanSummary({
  settings,
  hasStripeCustomer,
  hasPolarCustomer = false,
  className,
}: {
  settings: UserSettingsRow | null;
  hasStripeCustomer: boolean;
  hasPolarCustomer?: boolean;
  className?: string;
}) {
  const fields = {
    subscriptionPlan: settings?.subscriptionPlan,
    subscriptionStatus: settings?.subscriptionStatus,
    subscriptionPeriodEnd: settings?.subscriptionPeriodEnd,
    subscriptionTrialEnd: settings?.subscriptionTrialEnd,
  };

  const paying = isPayingPlatformSubscription(fields.subscriptionStatus);
  const statusLc = fields.subscriptionStatus?.toLowerCase() ?? "";
  const planKey = planDisplayToKey(settings?.subscriptionPlan ?? null);
  const catalog = planKey ? PLANS[planKey] : null;
  const billingProvider = hasPolarCustomer ? "Polar" : "Stripe";

  const planTitle = getPlanDisplayName({
    ...fields,
    polarBillingLinked: hasPolarCustomer,
  });

  const trialEnd = formatSubscriptionDate(fields.subscriptionTrialEnd);
  const periodEnd = formatSubscriptionDate(fields.subscriptionPeriodEnd);
  /** If Stripe hasn’t written trial_end yet, billing period end is the usual fallback while trialing. */
  const trialDisplayDate = trialEnd || (statusLc === "trialing" ? periodEnd : null);

  const featureBullets = catalog?.features?.slice(0, 4) ?? [];

  return (
    <div
      className={
        className ??
        "rounded-xl border border-zinc-800 bg-card/80 px-4 py-4 font-[family-name:var(--font-inter)] shadow-sm"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">Current plan</p>
          <p className="mt-1 font-headline text-xl font-light text-foreground">{planTitle}</p>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 text-sm font-medium text-foreground underline-offset-4 hover:text-zinc-400 hover:underline"
        >
          View plans
        </Link>
      </div>

      {statusLc === "trialing" ? (
        <div className="mt-4 rounded-lg border border-zinc-800/50 bg-muted/30 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Free trial</p>
          <p className="mt-1 text-base font-medium text-foreground">
            {trialDisplayDate ? (
              <>
                Your trial ends on{" "}
                <span className="tabular-nums text-foreground">{trialDisplayDate}</span>
              </>
            ) : (
              <>Trial dates will appear here shortly after checkout.</>
            )}
          </p>
          {catalog ? (
            <p className="mt-2 text-sm text-muted-foreground">
              After the trial, the <span className="text-foreground">{catalog.name}</span> plan continues at{" "}
              <span className="tabular-nums text-foreground">£{catalog.price} / month</span> unless you change or cancel
              in {billingProvider}.
            </p>
          ) : null}
        </div>
      ) : null}

      {statusLc === "active" ? (
        <div className="mt-4 space-y-1">
          <p className="text-sm text-foreground">
            <span className="font-medium">Active</span>
            {catalog ? (
              <>
                {" "}
                · <span className="tabular-nums">£{catalog.price} / month</span>
              </>
            ) : null}
          </p>
          {periodEnd ? (
            <p className="text-sm text-muted-foreground">
              Current billing period ends{" "}
              <span className="tabular-nums text-foreground">{periodEnd}</span>.
            </p>
          ) : null}
        </div>
      ) : null}

      {statusLc === "past_due" ? (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          Payment past due — update your card in the {billingProvider} portal (below) so your {planTitle} plan stays active.
        </p>
      ) : null}

      {(statusLc === "inactive" || statusLc === "canceled" || statusLc === "cancelled") && (hasStripeCustomer || hasPolarCustomer) ? (
        <p className="mt-4 text-sm text-muted-foreground">
          This subscription is no longer active. You can start again from{" "}
          <Link href="/pricing" className="font-medium text-foreground underline-offset-4 hover:text-zinc-400 hover:underline">
            pricing
          </Link>
          .
        </p>
      ) : null}

      {catalog?.tagline ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{catalog.tagline}</p>
      ) : paying && !catalog ? (
        <p className="mt-4 text-sm text-muted-foreground">
          You&apos;re on a paid Letora workspace. Full plan details will show here once your tier name syncs from
          {billingProvider} (usually within a minute).
        </p>
      ) : null}

      {featureBullets.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {featureBullets.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-zinc-500" aria-hidden>
                ·
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {!paying && !(hasStripeCustomer || hasPolarCustomer) ? (
        <p className="mt-4 text-sm text-muted-foreground">
          You&apos;re on Letora&apos;s included free workspace (up to{" "}
          <span className="tabular-nums text-foreground">{FREE_WORKSPACE_PROPERTY_CAP}</span> properties). Subscribe for unlimited properties and agents
          — start from{" "}
          <Link href="/pricing" className="font-medium text-foreground underline-offset-4 hover:text-zinc-400 hover:underline">
            pricing
          </Link>
          .
        </p>
      ) : null}

      {(hasStripeCustomer || hasPolarCustomer) && !statusLc ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Connecting your subscription to this page… If this doesn&apos;t update within a few minutes, refresh after
          checkout or open Billing again.
        </p>
      ) : null}
    </div>
  );
}
