import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tenancyId?: string; rentPaymentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenancyId = body.tenancyId?.trim();
  const rentPaymentId = body.rentPaymentId?.trim();

  if (!tenancyId || !rentPaymentId) {
    return NextResponse.json({ error: "tenancyId and rentPaymentId are required" }, { status: 400 });
  }

  const { data: tenancy, error: tenErr } = await supabase
    .from("tenancies")
    .select("monthly_rent, properties!inner(user_id)")
    .eq("id", tenancyId)
    .maybeSingle();

  if (tenErr || !tenancy) {
    return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
  }

  const prop = tenancy.properties as unknown as { user_id: string };
  if (prop.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const monthlyRent = Number(tenancy.monthly_rent) || 0;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(monthlyRent * 100),
    currency: "gbp",
    automatic_payment_methods: { enabled: true },
    metadata: {
      tenancy_id: tenancyId,
      user_id: user.id,
      rent_payment_id: rentPaymentId,
      payment_type: "rent",
    },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
