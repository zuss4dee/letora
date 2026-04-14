import { PLANS, PLAN_ORDER, type PlanKey } from "@/lib/stripe-plans";

/** Maps DB / UI display string to canonical PlanKey. */
export function planDisplayToKey(display: string | null | undefined): PlanKey | null {
  if (display == null || !String(display).trim()) return null;
  const t = display.trim();
  const lower = t.toLowerCase();
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

/** Resolve Stripe Price ID → PlanKey using env-configured IDs. */
export function getPlanKeyFromStripePriceId(priceId: string | null | undefined): PlanKey | null {
  if (!priceId?.trim()) return null;
  const id = priceId.trim();
  for (const key of PLAN_ORDER) {
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

function isSubscriptionEntitled(status: string | null | undefined): boolean {
  return isPayingPlatformSubscription(status);
}

export type UserPlanSettings = {
  subscription_plan: string | null;
  subscription_status: string | null;
};

/**
 * Effective plan for limits: paying users use resolved plan; otherwise Starter (3 props).
 * Documented default: unsubscribed / canceled → Starter cap for frictionless onboarding.
 */
export function getPlanKeyForUser(settings: UserPlanSettings): PlanKey {
  if (!isSubscriptionEntitled(settings.subscription_status)) {
    return "starter";
  }
  const fromDisplay = planDisplayToKey(settings.subscription_plan);
  if (fromDisplay) return fromDisplay;
  return "starter";
}

export function getMaxPropertiesForUser(settings: UserPlanSettings): number {
  const key = getPlanKeyForUser(settings);
  return PLANS[key].properties;
}

/** Optional structured flags for future Settings / agent gates (phase 2). */
export function planFeatures(key: PlanKey) {
  return {
    fullAgentLayer: key !== "starter",
    customAgentSettings: key !== "starter",
    contractTemplateUploads: key === "landlord_pro",
    maxProperties: PLANS[key].properties,
  };
}
