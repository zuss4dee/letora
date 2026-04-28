/**
 * Canonical subscription packaging for Letora.
 * Letora now uses a simple two-tier model: Monthly or Yearly.
 * Legacy plans (Starter, Pro, Portfolio) are kept for Stripe backward compatibility.
 */

export const PLANS = {
  // New Active Plans
  monthly: {
    name: "Monthly",
    priceId: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ?? "",
    price: 39,
    properties: -1,
    tagline: "Full access to Letora agents and features",
    highlighted: true,
    features: [
      "Unlimited properties",
      "All AI agents (CEO, maintenance, contracts)",
      "Automated rent chasing and lead qualifying",
      "Full tenancy and compliance tracking",
      "Priority support",
    ],
  },
  yearly: {
    name: "Yearly",
    priceId: process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID ?? "",
    price: 390,
    properties: -1,
    tagline: "Save 20% with annual billing",
    highlighted: false,
    badge: "2 months free",
    features: [
      "Everything in Monthly",
      "Dedicated account manager",
      "Strategic portfolio reviews",
      "Lock in price for 12 months",
    ],
  },
  // Legacy Plans (kept for Stripe users)
  starter: {
    name: "Starter",
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "",
    price: 19,
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
    price: 39,
    properties: 10,
    tagline: "Full agent layer for landlords who are scaling",
    highlighted: false,
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
    name: "Portfolio",
    priceId: process.env.NEXT_PUBLIC_STRIPE_LANDLORD_PRO_PRICE_ID ?? "",
    price: 79,
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

/** Stable order for pricing UI and upgrade paths. Only shows new active plans. */
export const PLAN_ORDER: readonly PlanKey[] = ["monthly", "yearly"] as const;

/** All plans including legacy ones. */
export const ALL_PLAN_KEYS: PlanKey[] = Object.keys(PLANS) as PlanKey[];
