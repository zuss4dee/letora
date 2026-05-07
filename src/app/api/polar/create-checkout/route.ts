import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  type CheckoutReturnTarget,
  checkoutSuccessPath,
} from "@/lib/stripe/checkout-return-target";
import { PLANS } from "@/lib/stripe-plans";

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const POLAR_API = "https://api.polar.sh";

/**
 * Polar.sh Checkout Session Creation
 * Uses the Polar REST API directly — no SDK dependency required.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { priceId?: string; plan?: string; returnTarget?: CheckoutReturnTarget };
    try {
      body = (await req.json()) as { priceId?: string; plan?: string; returnTarget?: CheckoutReturnTarget };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { priceId, plan } = body;
    const rawReturn = body.returnTarget;
    const returnTarget: CheckoutReturnTarget =
      rawReturn === "billing" || rawReturn === "onboarding" || rawReturn === "import"
        ? rawReturn
        : "billing";

    if (!priceId?.trim()) {
      console.warn("[polar create-checkout] missing priceId in request body");
      return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
    }

    if (!plan?.trim() || !(plan.trim() in PLANS)) {
      return NextResponse.json({ error: "Missing or invalid plan" }, { status: 400 });
    }

    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("[polar create-checkout] POLAR_ACCESS_TOKEN is not set");
      return NextResponse.json({ error: "Polar not configured" }, { status: 500 });
    }

    const successUrl = `${baseUrl()}${checkoutSuccessPath(returnTarget)}`;

    const polarRes = await fetch(`${POLAR_API}/v1/checkouts/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        product_price_id: priceId.trim(),
        success_url: successUrl,
        metadata: {
          user_id: user.id,
          plan: plan.trim(),
        },
      }),
    });

    if (!polarRes.ok) {
      const errText = await polarRes.text().catch(() => "Unknown error");
      console.error("[polar create-checkout] API error:", polarRes.status, errText);
      return NextResponse.json(
        { error: "Polar checkout creation failed" },
        { status: polarRes.status },
      );
    }

    const checkout = (await polarRes.json()) as { url?: string; id?: string };
    if (!checkout.url) {
      return NextResponse.json({ error: "No checkout URL returned from Polar" }, { status: 500 });
    }

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("[polar create-checkout] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
