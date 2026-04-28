import { NextRequest, NextResponse } from "next/server";
import { Polar } from "@polar-sh/sdk";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanKey } from "@/lib/stripe-plans";
import { POLAR_PLANS } from "@/lib/polar-plans";

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN ?? "",
  server: "sandbox", // Switch to "production" when ready
});

/**
 * Polar.sh Checkout Session Creation
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
      body = (await req.json()) as any;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { productId, plan } = body;

    if (!productId?.trim()) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }
    
    if (!plan?.trim() || !(plan.trim() in PLANS)) {
      return NextResponse.json(
        { error: 'Missing or invalid plan' },
        { status: 400 },
      );
    }

    const checkout = await polar.checkouts.create({
      productPriceId: productId.trim(),
      successUrl: `${baseUrl()}/dashboard/billing?checkout=success`,
      embedOrigin: baseUrl(),
      metadata: {
        user_id: user.id,
        plan: plan.trim(),
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Polar Checkout error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
