import { PLANS, type PlanKey } from "./stripe-plans";

/**
 * Mapping of Polar.sh Product IDs to Letora PlanKeys.
 * Letora now uses a two-tier model: Monthly or Yearly.
 */
export const POLAR_PLANS: Record<PlanKey, { productId: string }> = {
  monthly: {
    productId: process.env.NEXT_PUBLIC_POLAR_MONTHLY_ID ?? "659a2e39-6eb6-4cd0-a799-b0babcdbda14",
  },
  yearly: {
    productId: process.env.NEXT_PUBLIC_POLAR_YEARLY_ID ?? "5e5ace22-1695-4feb-a01b-d58da628280a",
  },
  // Legacy plans (kept for type safety, not used for Polar checkouts)
  starter: { productId: "" },
  pro: { productId: "" },
  landlord_pro: { productId: "" },
};

/**
 * Resolve Polar Product ID -> PlanKey.
 */
export function getPlanKeyFromPolarProductId(productId: string | null | undefined): PlanKey | null {
  if (!productId?.trim()) return null;
  const id = productId.trim();
  
  if (id === POLAR_PLANS.monthly.productId) return "monthly";
  if (id === POLAR_PLANS.yearly.productId) return "yearly";
  
  return null;
}

/**
 * Get the internal display name for a Polar product.
 */
export function getPlanNameFromPolarProductId(productId: string | null | undefined): string | null {
  const key = getPlanKeyFromPolarProductId(productId);
  return key ? PLANS[key].name : null;
}
