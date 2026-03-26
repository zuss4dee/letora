import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    console.log("APP_URL:", process.env.NEXT_PUBLIC_APP_URL);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as { priceId?: string; plan?: string };
    const { priceId, plan } = body;

    if (!priceId) return NextResponse.json({ error: "Missing priceId" }, { status: 400 });

    const { data: settings } = await supabase
      .from("user_settings")
      .select("stripe_customer_id, landlord_name")
      .eq("user_id", user.id)
      .single();

    let customerId = settings?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: settings?.landlord_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from("user_settings")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
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

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

