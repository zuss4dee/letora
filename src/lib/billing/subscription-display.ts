import { isPayingPlatformSubscription, planDisplayToKey } from "@/lib/plan-limits";
import { PLANS } from "@/lib/stripe-plans";

export type SubscriptionFields = {
  subscriptionPlan: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  subscriptionPeriodEnd: string | null | undefined;
  subscriptionTrialEnd: string | null | undefined;
  /** When Polar has linked IDs on this workspace (modern Monthly/Yearly checkout). */
  polarBillingLinked?: boolean;
};

/**
 * Canonical plan label aligned with entitlement + naming model:
 * - Free workspace → never "Starter".
 * - Paying Polar with stale SKU text → "Letora subscription" until webhook rewrites Monthly/Yearly.
 * - Paying Stripe-legacy subscribers → preserve catalog names until migrated.
 */
export function getPlanDisplayName(fields: SubscriptionFields): string {
  const paying = isPayingPlatformSubscription(fields.subscriptionStatus);
  const name = fields.subscriptionPlan?.trim() ?? "";
  const key = planDisplayToKey(name || null);

  if (!paying) {
    return "Free workspace";
  }

  if (key === "monthly") return PLANS.monthly.name;
  if (key === "yearly") return PLANS.yearly.name;
  if (name === PLANS.monthly.name || name === PLANS.yearly.name) return name;

  if (fields.polarBillingLinked) {
    if (!name || key === "starter" || key === "pro" || key === null) {
      return "Letora subscription";
    }
    return name;
  }

  if (key && key in PLANS) {
    return PLANS[key].name;
  }

  return name.length > 0 ? name : "Paid plan";
}

export function subscriptionStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return "No subscription";
  const s = status.toLowerCase();
  const map: Record<string, string> = {
    trialing: "Trial",
    active: "Active",
    past_due: "Past due",
    canceled: "Canceled",
    cancelled: "Canceled",
    incomplete: "Incomplete",
    incomplete_expired: "Incomplete (expired)",
    unpaid: "Unpaid",
    paused: "Paused",
    inactive: "Inactive",
  };
  return map[s] ?? status;
}

/** Sidebar line, e.g. "Monthly — Active" or "Free workspace — Free". */
export function getSidebarPlanStatusCompact(fields: SubscriptionFields): string {
  const planName = getPlanDisplayName(fields);
  const st = fields.subscriptionStatus?.toLowerCase() ?? "";
  if (st === "trialing") return `${planName} — Trial`;
  if (st === "active") return `${planName} — Active`;
  if (st === "past_due") return `${planName} — Past due`;
  if (isPayingPlatformSubscription(fields.subscriptionStatus)) {
    const tail = subscriptionStatusLabel(fields.subscriptionStatus);
    return `${planName} — ${tail}`;
  }
  return `${planName} — Free`;
}

export function formatSubscriptionDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
