import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlanPicker } from "@/components/onboarding/plan-picker";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe-plans";
import { getPendingCheckoutPlanFromMetadata } from "@/lib/stripe/pending-checkout";
import { platformCheckoutGate } from "@/lib/stripe/platform-checkout";

export const metadata: Metadata = {
  title: "Choose your plan · Letora",
  description: "Pick a plan to finish setting up your Letora workspace.",
};

export default async function OnboardingPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding/plan");
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("subscription_chosen_at, subscription_chosen_plan, subscription_plan, subscription_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = settings as
    | {
        subscription_chosen_at?: string | null;
        subscription_chosen_plan?: string | null;
        subscription_plan?: string | null;
        subscription_status?: string | null;
      }
    | null;

  if (row?.subscription_chosen_at) {
    redirect("/onboarding");
  }

  const checkoutGate = platformCheckoutGate();
  const checkoutAvailable = checkoutGate.ok;

  const pending = getPendingCheckoutPlanFromMetadata(
    user.user_metadata as Record<string, unknown> | null,
  );

  const proPriceId = PLANS.pro.priceId.trim();

  return (
    <PlanPicker
      checkoutAvailable={checkoutAvailable && proPriceId.length > 0}
      pendingPlan={pending}
    />
  );
}
