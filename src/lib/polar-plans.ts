import { PLANS, type PlanKey } from "./stripe-plans";

/**
 * Mapping of Polar.sh Product IDs to billing intervals under the Starter product (monthly vs yearly checkout).
 */
export const POLAR_PLANS: Record<PlanKey, { productId: string; priceId: string }> = {
  monthly: {
    productId: process.env.NEXT_PUBLIC_POLAR_MONTHLY_ID ?? "659a2e39-6eb6-4cd0-a799-b0babcdbda14",
    priceId: process.env.NEXT_PUBLIC_POLAR_MONTHLY_PRICE_ID ?? "9361fbd0-0a8d-46c2-9cb6-d666e471189e",
  },
  yearly: {
    productId: process.env.NEXT_PUBLIC_POLAR_YEARLY_ID ?? "5e5ace22-1695-4feb-a01b-d58da628280a",
    priceId: process.env.NEXT_PUBLIC_POLAR_YEARLY_PRICE_ID ?? "c024d723-1648-4e51-883e-bf8d3d560597",
  },
  // Legacy plans (kept for type safety, not used for Polar checkouts)
  starter: { productId: "", priceId: "" },
  pro: { productId: "", priceId: "" },
  landlord_pro: { productId: "", priceId: "" },
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
