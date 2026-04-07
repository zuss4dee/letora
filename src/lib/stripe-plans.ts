/** GBP/month display amounts — must match Stripe Product prices in Dashboard (live vs test price IDs). */
export const PLANS = {
  starter: {
    name: "Starter",
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID!,
    price: 29,
    properties: 3,
    features: [
      "Up to 3 properties",
      "Rent Chaser Agent",
      "Lead Qualifier Agent",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID!,
    price: 59,
    properties: 10,
    features: [
      "Up to 10 properties",
      "All AI Agents",
      "Contract Drafter Agent",
      "Priority support",
      "Custom agent settings",
    ],
  },
  landlord_pro: {
    name: "Landlord Pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_LANDLORD_PRO_PRICE_ID!,
    price: 99,
    properties: -1,
    features: [
      "Unlimited properties",
      "All AI Agents",
      "Contract templates upload",
      "Dedicated support",
      "White-label ready",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

