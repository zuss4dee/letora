import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // @ts-expect-error - Stripe v14 supports newer API versions
  apiVersion: "2024-12-18.acacia",
});

export type StripeRentMetadata = {
  tenancyId: string;
  userId: string;
  rentPaymentId: string;
  propertyAddress: string;
  tenantName: string;
};

export function buildRentMetadata(metadata: StripeRentMetadata): Record<string, string> {
  return {
    tenancy_id: metadata.tenancyId,
    user_id: metadata.userId,
    rent_payment_id: metadata.rentPaymentId,
    property_address: metadata.propertyAddress,
    tenant_name: metadata.tenantName,
    payment_type: "rent",
  };
}

export function gbpToPence(amount: number): number {
  return Math.round(amount * 100);
}
