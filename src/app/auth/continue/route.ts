import { NextResponse, type NextRequest } from "next/server";

import { isPayingPlatformSubscription } from "@/lib/plan-limits";
import { platformCheckoutGate } from "@/lib/stripe/platform-checkout";
import { checkoutUrlForPendingPlan, getPendingCheckoutPlanFromMetadata } from "@/lib/stripe/pending-checkout";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

/**
 * Post-auth router: sends users with `pending_checkout_plan` metadata to Stripe
 * when they still have no paying subscription (typical after email confirmation).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const nextPath = safeNextPath(new URL(request.url).searchParams.get("next"));
  const gate = platformCheckoutGate();
  const pending = getPendingCheckoutPlanFromMetadata(user.user_metadata as Record<string, unknown>);

  const { data: settings } = await supabase
    .from("user_settings")
    .select("subscription_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const subStatus =
    (settings as { subscription_status?: string | null } | null)?.subscription_status ?? null;

  if (gate.ok && pending && !isPayingPlatformSubscription(subStatus)) {
    const checkout = checkoutUrlForPendingPlan(request.nextUrl.origin, pending);
    if (checkout) {
      return NextResponse.redirect(checkout);
    }
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
