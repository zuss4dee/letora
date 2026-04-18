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
    .select("subscription_status, subscription_chosen_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const settingsRow = settings as
    | { subscription_status?: string | null; subscription_chosen_at?: string | null }
    | null;
  const subStatus = settingsRow?.subscription_status ?? null;
  const hasChosenPlan = Boolean(settingsRow?.subscription_chosen_at);

  if (gate.ok && pending && !isPayingPlatformSubscription(subStatus)) {
    const checkout = checkoutUrlForPendingPlan(request.nextUrl.origin, pending);
    if (checkout) {
      return NextResponse.redirect(checkout);
    }
  }

  // Hard plan-selection gate: a brand-new user who hasn't picked Starter or paid for Pro
  // must visit /onboarding/plan first. The middleware enforces this too, but doing it
  // here avoids a second redirect hop when bouncing off /login or /signup.
  if (!hasChosenPlan) {
    const url = new URL("/onboarding/plan", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
