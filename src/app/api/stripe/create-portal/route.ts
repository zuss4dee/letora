import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

function portalEnabled(): { ok: true } | { ok: false; status: number; message: string } {
  if (process.env.STRIPE_PLATFORM_CHECKOUT_ENABLED === "false") {
    return { ok: false, status: 501, message: "Platform Stripe billing is disabled." };
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
 * Stripe Customer Portal — update payment method, cancel subscription, view invoices.
 * Disabled when `STRIPE_PLATFORM_CHECKOUT_ENABLED=false` or `STRIPE_SECRET_KEY` is unset.
 */
export async function POST() {
  const gate = portalEnabled();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: settings } = await supabase
      .from("user_settings")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!settings?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing profile found" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
      customer: settings.stripe_customer_id,
      return_url: `${baseUrl}/dashboard/billing`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Portal session did not return a URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
