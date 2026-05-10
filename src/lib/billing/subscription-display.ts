import { isPayingPlatformSubscription, planDisplayToKey } from "@/lib/plan-limits";
import { PLANS } from "@/lib/stripe-plans";

/** Single public product name — billing cycle (monthly/yearly) is metadata, not a separate “plan tier”. */
export const LETORA_PRODUCT_PLAN_NAME = "Starter";

export type SubscriptionFields = {
  subscriptionPlan: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  subscriptionPeriodEnd: string | null | undefined;
  subscriptionTrialEnd: string | null | undefined;
  /** When Polar has linked IDs on this workspace (modern Monthly/Yearly checkout). */
  polarBillingLinked?: boolean;
};

/**
 * Canonical plan label for dashboards: one product (Starter), with free vs paying states only.
 */
export function getPlanDisplayName(fields: SubscriptionFields): string {
  const paying = isPayingPlatformSubscription(fields.subscriptionStatus);
  if (!paying) {
    return "Free workspace";
  }
  return LETORA_PRODUCT_PLAN_NAME;
}

/** Price line for an active subscription (GBP), from stored `subscription_plan` / legacy labels. */
export function getSubscriptionAmountLine(subscriptionPlan: string | null | undefined): string | null {
  const key = planDisplayToKey(subscriptionPlan?.trim() ?? null);
  if (key === "monthly") {
    return `£${PLANS.monthly.price} / month`;
  }
  if (key === "yearly") {
    return `£${PLANS.yearly.price} / year`;
  }
  if (key && key in PLANS) {
    const p = PLANS[key];
    if (key === "yearly") {
      return `£${p.price} / year`;
    }
    return `£${p.price} / month`;
  }
  return null;
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
