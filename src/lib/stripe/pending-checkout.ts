import type { PlanKey } from "@/lib/stripe-plans";
import { PLANS } from "@/lib/stripe-plans";

/** Stored on `raw_user_meta_data` at signup when the user must complete Stripe checkout after confirming email. */
export const PENDING_CHECKOUT_PLAN_META_KEY = "pending_checkout_plan" as const;

export function getPendingCheckoutPlanFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): PlanKey | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata[PENDING_CHECKOUT_PLAN_META_KEY];
  if (raw !== "starter" && raw !== "pro" && raw !== "landlord_pro") return null;
  return raw;
}

export function checkoutUrlForPendingPlan(origin: string, planKey: PlanKey): string | null {
  const priceId = PLANS[planKey].priceId?.trim();
  if (!priceId) return null;
  const u = new URL("/api/stripe/checkout", origin);
  u.searchParams.set("priceId", priceId);
  u.searchParams.set("plan", planKey);
  u.searchParams.set("return", "onboarding");
  return u.toString();
}
