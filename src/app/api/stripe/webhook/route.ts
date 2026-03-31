import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Stripe webhooks — disabled until pricing returns.
 * Requires: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, active `stripe` in `@/lib/stripe`,
 * SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL for the service-role client below.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Stripe webhooks are temporarily disabled." },
    { status: 501 },
  );
}

/*
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";

// Service role client — no user session available in webhooks
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getCustomerUserId(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data?.user_id ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await getCustomerUserId(sub.customer as string);
      if (userId) {
        await supabase
          .from("user_settings")
          .update({
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
            subscription_plan: sub.metadata?.plan ?? null,
            subscription_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq("user_id", userId);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await getCustomerUserId(sub.customer as string);
      if (userId) {
        await supabase
          .from("user_settings")
          .update({
            subscription_status: "inactive",
            subscription_plan: null,
            stripe_subscription_id: null,
          })
          .eq("user_id", userId);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const userId = await getCustomerUserId(invoice.customer as string);
      if (userId) {
        await supabase
          .from("user_settings")
          .update({
            subscription_status: "past_due",
          })
          .eq("user_id", userId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
*/
