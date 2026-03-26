import Stripe from "stripe";
import { PLANS } from "@/lib/stripe-plans";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export { PLANS };

