import type Stripe from "stripe";
import type { User } from "@supabase/supabase-js";

import type { CheckoutReturnTarget } from "@/lib/stripe/checkout-return-target";
import { PLANS, type PlanKey } from "@/lib/stripe-plans";
import { stripe } from "@/lib/stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export function platformCheckoutGate(): { ok: true } | { ok: false; status: number; message: string } {
  if (process.env.STRIPE_PLATFORM_CHECKOUT_ENABLED === "false") {
    return { ok: false, status: 501, message: "Platform Stripe Checkout is disabled." };
  }
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return {
      ok: false,
      status: 503,
      message: "Stripe is not configured (missing STRIPE_SECRET_KEY).",
    };
  }
  return { ok: true };
}

/** Ensures request priceId matches the declared plan key (anti-tamper). */
export function assertPriceIdMatchesPlan(priceId: string, planKey: PlanKey): { ok: true } | { ok: false; message: string } {
  const expected = PLANS[planKey].priceId?.trim();
  const got = priceId.trim();
  if (!expected) {
    return { ok: false, message: `Plan ${planKey} has no configured price ID (env NEXT_PUBLIC_*).` };
  }
  if (expected !== got) {
    return { ok: false, message: "Price does not match selected plan." };
  }
  return { ok: true };
}

export async function createPlatformCheckoutSession(
  supabase: SupabaseClient,
  user: User,
  params: { priceId: string; planKey: PlanKey; returnTarget?: CheckoutReturnTarget },
): Promise<{ url: string } | { error: string; status?: number }> {
  const match = assertPriceIdMatchesPlan(params.priceId, params.planKey);
  if (!match.ok) {
    return { error: match.message, status: 400 };
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("stripe_customer_id, landlord_name")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = settings?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: settings?.landlord_name ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    console.log("[createPlatformCheckoutSession] user before stripe_customer_id update", user);
    const { error: updateError } = await supabase
      .from("user_settings")
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    console.log("[createPlatformCheckoutSession] user_settings update result", { customerId, updateError });
    if (updateError) {
      console.error("user_settings update (stripe_customer_id):", updateError);
      return { error: "Could not save billing profile. Try again.", status: 500 };
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const planMeta = params.planKey;
  const returnTarget = params.returnTarget ?? "default";
  const successPath =
    returnTarget === "billing"
      ? "/dashboard/billing?checkout=success"
      : returnTarget === "onboarding"
        ? "/onboarding?checkout=success"
        : "/dashboard/home?success=true";
  const cancelPath =
    returnTarget === "billing"
      ? "/dashboard/billing?checkout=cancelled"
      : returnTarget === "onboarding"
        ? "/onboarding?checkout=cancelled"
        : "/pricing?cancelled=true";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const chargeDateLabel = tomorrow.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const trialMessage = `Your 24-hour free trial starts today. You won't be charged until ${chargeDateLabel}.`;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: "subscription",
    /**
     * `link` = Stripe Link (saved details / one-click). Add more types (e.g. `bacs_debit` for UK DD) only after
     * enabling them in Stripe Dashboard → Settings → Payment methods, or Checkout will error.
     */
    payment_method_types: ["card", "link"],
    line_items: [{ price: params.priceId.trim(), quantity: 1 }],
    success_url: `${baseUrl}${successPath}`,
    cancel_url: `${baseUrl}${cancelPath}`,
    client_reference_id: user.id,
    metadata: { user_id: user.id, plan: planMeta },
    subscription_data: {
      trial_period_days: 1,
      metadata: { user_id: user.id, plan: planMeta },
    },
    custom_text: {
      submit: { message: trialMessage },
    },
  };

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    return { error: "Checkout session did not return a URL", status: 500 };
  }

  return { url: session.url };
}
