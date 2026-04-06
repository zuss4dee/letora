import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

function platformCheckoutEnabled(): { ok: true } | { ok: false; status: number; message: string } {
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

/**
 * Platform subscription Checkout (Stripe test/live per `STRIPE_SECRET_KEY`).
 * Disabled when `STRIPE_PLATFORM_CHECKOUT_ENABLED=false` or `STRIPE_SECRET_KEY` is unset.
 */
export async function POST(req: NextRequest) {
  const gate = platformCheckoutEnabled();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { priceId?: string; plan?: string };
    try {
      body = (await req.json()) as { priceId?: string; plan?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { priceId, plan } = body;

    if (!priceId?.trim()) {
      return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
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
      const { error: upsertError } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (upsertError) {
        console.error("user_settings upsert (stripe_customer_id):", upsertError);
        return NextResponse.json(
          { error: "Could not save billing profile. Try again." },
          { status: 500 },
        );
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const planMeta = plan ?? "";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?success=true`,
      cancel_url: `${baseUrl}/pricing?cancelled=true`,
      metadata: { user_id: user.id, plan: planMeta },
      subscription_data: { metadata: { user_id: user.id, plan: planMeta } },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout session did not return a URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
