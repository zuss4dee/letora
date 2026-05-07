import { NextRequest, NextResponse } from "next/server";

import { createPlatformCheckoutSession, platformCheckoutGate } from "@/lib/stripe/platform-checkout";
import type { CheckoutReturnTarget } from "@/lib/stripe/checkout-return-target";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanKey } from "@/lib/stripe-plans";

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Browser redirect after signup: `GET /api/stripe/checkout?priceId=...&plan=starter|pro|landlord_pro`.
 * Requires an authenticated session (cookies).
 */
export async function GET(req: NextRequest) {
  const gate = platformCheckoutGate();
  if (gate.ok === false) {
    return NextResponse.redirect(`${baseUrl()}/pricing?checkout=unavailable`, 303);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(
        `${baseUrl()}/login?next=${encodeURIComponent("/pricing")}`,
        303,
      );
    }

    const { searchParams } = req.nextUrl;
    const priceId = searchParams.get("priceId")?.trim();
    const planRaw = searchParams.get("plan")?.trim();

    if (!priceId || !planRaw || !(planRaw in PLANS)) {
      return NextResponse.redirect(`${baseUrl()}/pricing?checkout=invalid`, 303);
    }

    const planKey = planRaw as PlanKey;
    const returnRaw = searchParams.get("return")?.trim();
    const returnTarget: CheckoutReturnTarget =
      returnRaw === "billing"
        ? "billing"
        : returnRaw === "onboarding"
          ? "onboarding"
          : returnRaw === "import"
            ? "import"
            : "default";

    const result = await createPlatformCheckoutSession(supabase, user, {
      priceId,
      planKey,
      returnTarget,
    });

    if ("error" in result) {
      return NextResponse.redirect(
        `${baseUrl()}/pricing?checkout=error&reason=${encodeURIComponent(result.error.slice(0, 80))}`,
        303,
      );
    }

    return NextResponse.redirect(result.url, 303);
  } catch (error) {
    console.error("Checkout GET error:", error);
    return NextResponse.redirect(`${baseUrl()}/pricing?checkout=error`, 303);
  }
}

/**
 * Platform subscription Checkout (Stripe test/live per `STRIPE_SECRET_KEY`).
 * Disabled when `STRIPE_PLATFORM_CHECKOUT_ENABLED=false` or `STRIPE_SECRET_KEY` is unset.
 * Prefer POST body: `{ "priceId": "...", "plan": "starter" | "pro" | "landlord_pro" }`.
 */
export async function POST(req: NextRequest) {
  const gate = platformCheckoutGate();
  if (gate.ok === false) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

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

    const { priceId, plan, returnTarget } = body;

    if (!priceId?.trim()) {
      return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
    }
    if (!plan?.trim() || !(plan.trim() in PLANS)) {
      return NextResponse.json(
        { error: 'Missing or invalid plan (expected "starter", "pro", or "landlord_pro")' },
        { status: 400 },
      );
    }

    const planKey = plan.trim() as PlanKey;
    const resolvedReturn: CheckoutReturnTarget =
      returnTarget === "billing"
        ? "billing"
        : returnTarget === "onboarding"
          ? "onboarding"
          : returnTarget === "import"
            ? "import"
            : "default";
    const result = await createPlatformCheckoutSession(supabase, user, {
      priceId: priceId.trim(),
      planKey,
      returnTarget: resolvedReturn,
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 },
      );
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Checkout error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
