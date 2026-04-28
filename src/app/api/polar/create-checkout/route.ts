import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    let body: { productId?: string; plan?: string; returnTarget?: string };
    try {
      body = (await req.json()) as { productId?: string; plan?: string; returnTarget?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { productId, plan } = body;

    if (!productId?.trim()) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    if (!plan?.trim() || !(plan.trim() in PLANS)) {
      return NextResponse.json({ error: "Missing or invalid plan" }, { status: 400 });
    }

    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Polar not configured" }, { status: 500 });
    }

    const successUrl = `${baseUrl()}/dashboard/billing?checkout=success`;

    const polarRes = await fetch(`${POLAR_API}/v1/checkouts/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        product_price_id: productId.trim(),
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
