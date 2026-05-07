import { ALL_PLAN_KEYS, PLANS, type PlanKey } from "@/lib/stripe-plans";

/**
 * Max properties for workspaces without an active paying Letora subscription.
 * Matches the legacy free onboarding cap — not branded as a "Starter SKU" for entitlements anymore.
 */
export const FREE_WORKSPACE_PROPERTY_CAP = 3;

/** Maps DB / UI display string to canonical PlanKey (including legacy tiers still stored from Stripe-only users). */
export function planDisplayToKey(display: string | null | undefined): PlanKey | null {
  if (display == null || !String(display).trim()) return null;
  const t = display.trim();
  const lower = t.toLowerCase();

  if (lower === "monthly" || t === PLANS.monthly.name) return "monthly";
  if (lower === "yearly" || t === PLANS.yearly.name) return "yearly";

  if (lower === "starter" || t === PLANS.starter.name) return "starter";
  if (lower === "pro" || t === PLANS.pro.name) return "pro";
  if (lower === "landlord_pro" || lower === "portfolio" || t === PLANS.landlord_pro.name) {
    return "landlord_pro";
  }
  return null;
}

export function planKeyToDisplayName(key: PlanKey): string {
  return PLANS[key].name;
}

/** Resolve Stripe Price ID → PlanKey using env-configured IDs (modern + legacy products). */
export function getPlanKeyFromStripePriceId(priceId: string | null | undefined): PlanKey | null {
  if (!priceId?.trim()) return null;
  const id = priceId.trim();
  for (const key of ALL_PLAN_KEYS) {
    const pid = PLANS[key].priceId?.trim();
    if (pid && pid === id) return key;
  }
  return null;
}

/** Metadata.plan from checkout is the canonical key (starter | pro | landlord_pro). */
export function planKeyFromMetadata(metaPlan: string | null | undefined): PlanKey | null {
  if (!metaPlan?.trim()) return null;
  const n = metaPlan.trim() as PlanKey;
  if (n in PLANS) return n;
  return planDisplayToKey(metaPlan);
}

/** Resolve tier from Stripe subscription metadata and/or first line item price id. */
export function resolvePlanKeyFromStripeSubscription(sub: {
  metadata?: Record<string, string | undefined> | null;
  items?: { data: Array<{ price?: { id?: string } | string | null } | null> };
}): PlanKey | null {
  const fromMeta = planKeyFromMetadata(sub.metadata?.plan ?? null);
  if (fromMeta) return fromMeta;
  const first = sub.items?.data?.[0];
  const p = first?.price;
  const priceId = typeof p === "string" ? p : p?.id ?? null;
  return getPlanKeyFromStripePriceId(priceId);
}

const PAYING_STATUSES = new Set(["active", "trialing", "past_due"]);

/** Exported for billing gates (auth continue, middleware). */
export function isPayingPlatformSubscription(status: string | null | undefined): boolean {
  if (!status) return false;
  return PAYING_STATUSES.has(status);
}

export type UserPlanSettings = {
  subscription_plan: string | null;
  subscription_status: string | null;
};

/**
 * Property import / creation allowance.
 * Single modern rule: anyone on an active platform subscription (`active` · `trialing` · `past_due`)
 * gets uncapped portfolios. Only truly unsubscribed / inactive workspaces use the small free allowance.
 *
 * Billing tier SKU (Starter/Pro/etc.) must not downgrade an active payer when `subscription_plan` is stale or null.
 */
export function getMaxPropertiesForUser(settings: UserPlanSettings): number {
  if (isPayingPlatformSubscription(settings.subscription_status)) {
    return -1;
  }
  return FREE_WORKSPACE_PROPERTY_CAP;
}
