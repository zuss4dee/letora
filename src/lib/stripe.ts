/**
 * Stripe client — disabled while pricing / billing UI is removed.
 *
 * Re-enable when restoring checkout + portal + webhooks:
 * - STRIPE_SECRET_KEY — Dashboard → Developers → API keys
 * - STRIPE_WEBHOOK_SECRET — used by `src/app/api/stripe/webhook/route.ts`
 * - Price IDs — `src/lib/stripe-plans.ts` and checkout body
 */

// import Stripe from "stripe";
// import { PLANS } from "@/lib/stripe-plans";
//
// export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: "2023-10-16",
// });
//
// export { PLANS };
