import { NextResponse } from "next/server";

import { stripe, gbpToPence, buildRentMetadata } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tenancyId?: string; rentPaymentId?: string; returnUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenancyId = body.tenancyId?.trim();
  const rentPaymentId = body.rentPaymentId?.trim();
  const returnUrl = body.returnUrl?.trim() ?? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://letora.co"}/dashboard/rent`;

  if (!tenancyId || !rentPaymentId) {
    return NextResponse.json({ error: "tenancyId and rentPaymentId are required" }, { status: 400 });
  }

  const { data: tenancy, error: tenErr } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      monthly_rent,
      properties!inner ( address, city, postcode, user_id ),
      tenants ( full_name, email )
    `,
    )
    .eq("id", tenancyId)
    .maybeSingle();

  if (tenErr || !tenancy) {
    return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
  }

  const prop = tenancy.properties as unknown as {
    address: string | null;
    city: string | null;
    postcode: string | null;
    user_id: string;
  };

  if (prop.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tenantRaw = tenancy.tenants as unknown as
    | { full_name: string | null; email: string | null }
    | { full_name: string | null; email: string | null }[]
    | null;
  const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;

  const addressLabel = [prop.address, prop.city, prop.postcode].filter(Boolean).join(", ");
  const monthlyRent = Number(tenancy.monthly_rent) || 0;

  const metadata = buildRentMetadata({
    tenancyId,
    userId: user.id,
    rentPaymentId,
    propertyAddress: addressLabel || "Property",
    tenantName: tenant?.full_name ?? "Tenant",
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Rent — ${addressLabel || "Property"}`,
            description: `Monthly rent payment`,
          },
          unit_amount: gbpToPence(monthlyRent),
        },
        quantity: 1,
      },
    ],
    metadata,
    customer_email: tenant?.email ?? undefined,
    success_url: `${returnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}?payment=cancelled`,
    payment_intent_data: {
      metadata,
    },
  });

  return NextResponse.json({ url: session.url });
}
