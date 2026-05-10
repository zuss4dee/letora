"use client";

import { useRouter } from "next/navigation";

import type { UserSettingsRow } from "@/lib/actions/user-settings";
import {
  formatSubscriptionDate,
  getPlanDisplayName,
  getSubscriptionAmountLine,
  subscriptionStatusLabel,
} from "@/lib/billing/subscription-display";
import { BillingPlanOptions } from "@/components/billing/billing-plan-options";
import { ManageBillingButton } from "@/components/settings/manage-billing-button";
import { isPayingPlatformSubscription } from "@/lib/plan-limits";

export type WorkspaceOperationalStats = {
  propertyCount: number;
  /** `null` when the tenancy rollup query fails (relationship hint); entitlement is still unlimited for paid workspaces. */
  tenancyCount: number | null;
};

type Props = {
  settings: Partial<UserSettingsRow> | null;
  /** Retained for future use; single-plan billing does not surface usage caps here. */
  operationalStats?: WorkspaceOperationalStats | null;
};

export function WorkspaceBillingView({ settings }: Props) {
  const router = useRouter();

  const polarBillingLinked = Boolean(
    settings?.polarCustomerId?.trim() || settings?.polarSubscriptionId?.trim(),
  );
  const stripeLinked = Boolean(settings?.stripeCustomerId?.trim());

  const subFields = {
    subscriptionPlan: settings?.subscriptionPlan,
    subscriptionStatus: settings?.subscriptionStatus,
    subscriptionPeriodEnd: settings?.subscriptionPeriodEnd,
    subscriptionTrialEnd: settings?.subscriptionTrialEnd,
    polarBillingLinked,
  };

  const planLabel = getPlanDisplayName(subFields);
  const paying = isPayingPlatformSubscription(settings?.subscriptionStatus);
  const statusLabel = subscriptionStatusLabel(settings?.subscriptionStatus);
  const nextBill = formatSubscriptionDate(settings?.subscriptionPeriodEnd);
  const amountLine =
    getSubscriptionAmountLine(settings?.subscriptionPlan ?? null) ??
    (paying ? "Amount syncs after checkout — open subscription management below." : null);

  const portalProvider = polarBillingLinked ? "polar" : stripeLinked ? "stripe" : null;

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-24">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl dark:text-zinc-100">
            Billing
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Letora Starter — subscribe through Polar when you&apos;re ready.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/settings")}
          className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Settings
        </button>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#161616]">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Subscription</h2>
        <dl className="mt-6 space-y-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-8">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Current plan
            </dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{planLabel}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-8">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Status
            </dt>
            <dd className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {settings?.subscriptionStatus?.toLowerCase() === "active" ? (
                <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              ) : null}
              {statusLabel}
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-8">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Next billing date
            </dt>
            <dd className="text-sm font-medium text-zinc-900 tabular-nums dark:text-zinc-100">
              {nextBill ?? "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-8">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Amount
            </dt>
            <dd className="text-sm font-medium text-zinc-900 tabular-nums dark:text-zinc-100">{amountLine ?? "—"}</dd>
          </div>
        </dl>

        <div className="mt-8 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          {portalProvider ? (
            <ManageBillingButton provider={portalProvider} />
          ) : paying ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Subscription data is still linking. Refresh in a moment or sign in again after checkout.
            </p>
          ) : null}
        </div>
      </section>

      {!paying && !portalProvider ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Subscribe to Starter</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Choose monthly or yearly billing. You’ll return here when checkout completes.
          </p>
          <BillingPlanOptions checkoutReturnTarget="billing" />
        </section>
      ) : null}

      <section className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Invoices &amp; payments</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Receipts and billing history appear in your{" "}
          {polarBillingLinked ? "Polar" : stripeLinked ? "Stripe customer" : "billing"} portal. Use Manage Subscription
          above to open it.
        </p>
      </section>
    </div>
  );
}
