import { NextRequest, NextResponse } from "next/server";

/**
 * Stripe Customer Portal — disabled until pricing returns.
 * Requires: STRIPE_SECRET_KEY, active `stripe` export in `@/lib/stripe`.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Stripe billing is temporarily disabled." },
    { status: 501 },
  );
}

/*
import { NextRequest, NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: settings } = await supabase
    .from("user_settings")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!settings?.stripe_customer_id) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: settings.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings`,
  });

  return NextResponse.json({ url: session.url });
}
*/
