"use client";

import { useRouter } from "next/navigation";
import type { UserSettingsRow } from "@/lib/actions/user-settings";
import { getPlanDisplayName } from "@/lib/billing/subscription-display";
import {
  FREE_WORKSPACE_PROPERTY_CAP,
  getMaxPropertiesForUser,
  isPayingPlatformSubscription,
} from "@/lib/plan-limits";
import { cn } from "@/lib/utils";

export type WorkspaceOperationalStats = {
  propertyCount: number;
  /** `null` when the tenancy rollup query fails (relationship hint); entitlement is still unlimited for paid workspaces. */
  tenancyCount: number | null;
};

const EMPTY_OPERATIONAL_STATS: WorkspaceOperationalStats = {
  propertyCount: 0,
  tenancyCount: null,
};

function normalizeOperationalStats(
  raw: WorkspaceOperationalStats | null | undefined,
): { stats: WorkspaceOperationalStats; inferredMissing: boolean } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { stats: EMPTY_OPERATIONAL_STATS, inferredMissing: true };
  }
  const propertyCountRaw = (raw as { propertyCount?: unknown }).propertyCount;
  const propertyCount =
    typeof propertyCountRaw === "number" && Number.isFinite(propertyCountRaw)
      ? Math.max(0, propertyCountRaw)
      : 0;
  const tc = (raw as { tenancyCount?: unknown }).tenancyCount;
  const tenancyCount =
    tc === undefined || tc === null
      ? null
      : typeof tc === "number" && Number.isFinite(tc)
        ? Math.max(0, tc)
        : null;

  return { stats: { propertyCount, tenancyCount }, inferredMissing: false };
}

type Props = {
  settings: Partial<UserSettingsRow> | null;
  /** When omitted (or malformed), defaults to `{ propertyCount: 0, tenancyCount: null }` so the billing UI never crashes. */
  operationalStats?: WorkspaceOperationalStats | null;
};

export function WorkspaceBillingView({ settings, operationalStats }: Props) {
  const { stats: normalizedStats, inferredMissing } = normalizeOperationalStats(operationalStats);
  const router = useRouter();

  const status = settings?.subscriptionStatus?.toLowerCase() || "inactive";
  const polarBillingLinked = Boolean(
    settings?.polarCustomerId?.trim() || settings?.polarSubscriptionId?.trim(),
  );
  const stripeLinked = Boolean(settings?.stripeCustomerId?.trim());

  const planLabel = getPlanDisplayName({
    subscriptionPlan: settings?.subscriptionPlan,
    subscriptionStatus: settings?.subscriptionStatus,
    subscriptionPeriodEnd: settings?.subscriptionPeriodEnd,
    subscriptionTrialEnd: settings?.subscriptionTrialEnd,
    polarBillingLinked,
  });

  const renewalDate = settings?.subscriptionPeriodEnd
    ? new Date(settings?.subscriptionPeriodEnd).toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "N/A";

  const paying = isPayingPlatformSubscription(settings?.subscriptionStatus);

  const billingPrimary = polarBillingLinked
    ? "Polar"
    : stripeLinked
      ? "Stripe"
      : paying
        ? "Connected"
        : "Not connected";
  const billingDetail = polarBillingLinked
    ? "Monthly or yearly Letora subscription checkout"
    : stripeLinked
      ? "Legacy subscriber billing (customer portal)"
      : "Link a plan from Pricing to activate checkout";

  const maxProps = getMaxPropertiesForUser({
    subscription_plan: settings?.subscriptionPlan ?? null,
    subscription_status: settings?.subscriptionStatus ?? null,
  });

  const portfolioCapLabel = maxProps === -1 ? "Unlimited" : String(FREE_WORKSPACE_PROPERTY_CAP);
  const portfolioUsageLabel =
    maxProps === -1
      ? `${normalizedStats.propertyCount.toLocaleString()} / Unlimited`
      : `${normalizedStats.propertyCount} / ${FREE_WORKSPACE_PROPERTY_CAP}`;

  const portfolioFillPct =
    maxProps === -1 ? 100 : Math.min(100, Math.round((normalizedStats.propertyCount / maxProps) * 100));

  const tenancyUsageLabel =
    normalizedStats.tenancyCount === null
      ? "— / Unlimited"
      : `${normalizedStats.tenancyCount.toLocaleString()} / Unlimited`;

  return (
    <div className="mx-auto max-w-6xl space-y-12 pb-24">
      {/* 01. HEADER */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-800/50 bg-background dark:bg-[#0b0b0b]/80 py-6 backdrop-blur-md">
        <div className="space-y-1">
          <h1 className="text-[16px] font-black italic tracking-tight text-zinc-900 dark:text-white uppercase">
            Financial Operations
          </h1>
          <div className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Subscription Ledger
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/settings")}
          className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase transition-colors hover:text-zinc-900 dark:hover:text-zinc-900 dark:text-white"
        >
          Back to Settings
        </button>
      </header>

      {/* 02. PLAN SUMMARY GRID */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-zinc-600">receipt_long</span>
          <h2 className="text-[11px] font-black tracking-[0.2em] text-zinc-400 uppercase">Active Subscription</h2>
        </div>

        <div className="grid grid-cols-12 gap-px overflow-hidden border border-zinc-800/50 bg-zinc-200 dark:bg-zinc-800">
          <div className="col-span-12 space-y-6 bg-background dark:bg-[#111111] p-8 md:col-span-8">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Letora plan</p>
                <p className="text-[24px] font-black italic tracking-tight text-zinc-900 dark:text-white uppercase">{planLabel}</p>
                {paying && polarBillingLinked ? (
                  <p className="text-[10px] font-bold tracking-tight text-zinc-500 uppercase">
                    Polar · same limits as app enforcement
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 text-right">
                <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Current Status</p>
                <div className="flex items-center justify-end gap-2">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      status === "active" ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-zinc-700",
                    )}
                  />
                  <p className="text-[14px] font-black text-zinc-900 dark:text-white uppercase">{status}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 border-t border-zinc-800/50 pt-8">
              <div className="space-y-1">
                <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Next Invoice Date</p>
                <p className="text-[13px] font-bold text-zinc-900 dark:text-white">{renewalDate}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Billing rails</p>
                <p className="text-[13px] font-bold text-zinc-900 dark:text-white uppercase">{billingPrimary}</p>
                <p className="text-[10px] leading-snug text-zinc-500">{billingDetail}</p>
              </div>
            </div>
          </div>

          <div className="col-span-12 flex flex-col justify-between border-l border-zinc-800/50 bg-background dark:bg-[#141414] p-8 md:col-span-4">
            <div className="space-y-4">
              <p className="text-[10px] leading-relaxed font-bold tracking-tighter text-zinc-500 uppercase">
                Manage cards, invoices, and renewals in Polar or the Stripe customer portal for legacy accounts.
              </p>
            </div>
            <div className="space-y-2 pt-8">
              <button
                type="button"
                className="w-full bg-white py-3 text-[10px] font-black tracking-widest text-black uppercase transition-all hover:bg-zinc-200"
              >
                Access Billing Portal
              </button>
              <button
                type="button"
                className="w-full border border-zinc-800 bg-transparent py-3 text-[10px] font-black tracking-widest text-zinc-500 uppercase transition-all hover:border-white hover:text-zinc-900 dark:hover:text-zinc-900 dark:text-white"
              >
                Download Latest Invoice
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 03. USAGE — matches getMaxPropertiesForUser / import guardrails */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-zinc-600">monitoring</span>
          <h2 className="text-[11px] font-black tracking-[0.2em] text-zinc-400 uppercase">Operational Capacity</h2>
        </div>
        {inferredMissing ? (
          <p className="rounded border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-[10px] leading-relaxed text-amber-200/90">
            Usage counts were not provided to this view (showing 0 until data loads). Refresh if this persists after
            navigation.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-12 border border-zinc-800/50 bg-background dark:bg-[#111111] p-8 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Portfolio units</p>
              <p className="text-[11px] font-bold whitespace-nowrap text-zinc-900 dark:text-white">{portfolioUsageLabel}</p>
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-500">
              {maxProps === -1
                ? "Subscribed workspaces include unlimited properties."
                : `Free workspace includes up to ${portfolioCapLabel} properties (same cap as portfolio import).`}
            </p>
            <div className="h-1 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
              <div
                className={cn("h-full transition-[width]", maxProps === -1 ? "bg-emerald-500/90" : "bg-white")}
                style={{ width: `${portfolioFillPct}%` }}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Active tenancies</p>
              <p className="text-[11px] font-bold whitespace-nowrap text-zinc-900 dark:text-white">{tenancyUsageLabel}</p>
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-500">Not limited by the property cap on any plan.</p>
            <div className="h-1 w-full bg-emerald-500/20">
              <div className="h-full w-full bg-emerald-500/40" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Agent automations</p>
              <p className="text-[11px] font-bold text-zinc-900 dark:text-white">{paying ? "Full access" : "Upgrade to unlock"}</p>
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-500">
              {paying ? "Agents follow your subscription status in the app." : "Subscribe to run the full agent surface."}
            </p>
            <div className="h-1 bg-emerald-500/20" />
          </div>
        </div>
      </section>

      {/* 04. HISTORY */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-zinc-600">history</span>
          <h2 className="text-[11px] font-black tracking-[0.2em] text-zinc-400 uppercase">Transaction History</h2>
        </div>
        <div className="space-y-2 border border-dashed border-zinc-800/50 bg-background dark:bg-[#111111] p-8 text-center">
          <p className="text-[11px] font-bold text-zinc-600 uppercase">Archive synchronization in progress</p>
          <p className="text-[9px] tracking-tighter text-zinc-700 uppercase">
            Detailed line-item history is available in your primary billing portal.
          </p>
        </div>
      </section>
    </div>
  );
}
