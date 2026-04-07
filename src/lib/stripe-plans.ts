/**
 * Canonical subscription packaging for Letora (GBP/month).
 * Price IDs must match Stripe Dashboard products (see .env.example).
 * Display copy here should stay aligned with what checkout and webhooks record in metadata.plan.
 */

export const PLANS = {
  starter: {
    name: "Starter",
    /** Stripe Price ID (monthly GBP) */
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "",
    price: 29,
    /** Max properties; -1 means unlimited */
    properties: 3,
    tagline: "Core workspace for a small UK portfolio",
    highlighted: false,
    features: [
      "Up to 3 properties",
      "Lead inbox and pipeline",
      "Rent Chaser and Lead Qualifier agents",
      "Tenancy, rent, and maintenance surfaces",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "",
    price: 59,
    properties: 10,
    tagline: "Full agent layer for landlords who are scaling",
    highlighted: true,
    badge: "Most popular",
    features: [
      "Up to 10 properties",
      "All AI agents (maintenance, contracts, onboarding, assistant)",
      "Custom agent behaviour and email automation in Settings",
      "Priority support",
      "Higher fair-use limits on automation",
    ],
  },
  landlord_pro: {
    /** Shown as "Portfolio" in marketing; key stays stable for Stripe metadata.code */
    name: "Portfolio",
    priceId: process.env.NEXT_PUBLIC_STRIPE_LANDLORD_PRO_PRICE_ID ?? "",
    price: 99,
    properties: -1,
    tagline: "Unlimited doors and heavier support",
    highlighted: false,
    features: [
      "Unlimited properties (fair use)",
      "Everything in Pro",
      "Contract template uploads and advanced drafting",
      "Dedicated support for operational questions",
      "Built for multi-seat teams and larger portfolios",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/** Stable order for pricing UI and upgrade paths */
export const PLAN_ORDER: readonly PlanKey[] = ["starter", "pro", "landlord_pro"] as const;
