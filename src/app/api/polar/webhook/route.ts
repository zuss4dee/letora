import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { syncSubscriptionToUserSettings } from "@/lib/billing/sync";
import { getPlanKeyFromPolarProductId } from "@/lib/polar-plans";

/**
 * Polar.sh Webhook Handler
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const headers = Object.fromEntries(req.headers.entries());
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[polar webhook] POLAR_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const svix = new Webhook(webhookSecret);
  let event: any;

  try {
    event = svix.verify(body, headers) as any;
  } catch (err) {
    console.error("[polar webhook] verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    const { type, data } = event;

    switch (type) {
      case "subscription.created":
      case "subscription.updated": {
        const sub = data;
        const userId = sub.metadata?.user_id;
        
        if (!userId) {
          console.warn("[polar webhook] subscription event missing user_id metadata", { subId: sub.id });
          break;
        }

        const planKey = getPlanKeyFromPolarProductId(sub.product_id);

        await syncSubscriptionToUserSettings(supabase, {
          userId,
          provider: "polar",
          subscriptionId: sub.id,
          customerId: sub.customer_id,
          status: sub.status, // Polar status (active, trialing, etc.)
          planKey,
          periodEnd: new Date(sub.current_period_end),
          trialEnd: sub.trial_end ? new Date(sub.trial_end) : null,
        });
        break;
      }

      case "subscription.revoked": {
        const sub = data;
        const userId = sub.metadata?.user_id;

        if (userId) {
          await supabase
            .from("user_settings")
            .update({
              subscription_status: "inactive",
              subscription_plan: null,
              polar_subscription_id: null,
              subscription_period_end: null,
              subscription_trial_end: null,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }
        break;
      }

      default:
        // Handle other events if necessary
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[polar webhook] handler error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
