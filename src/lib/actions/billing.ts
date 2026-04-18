"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ChooseStarterPlanResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Marks the user as having explicitly chosen the free Starter plan. This is
 * what flips the plan-selection gate (`subscription_chosen_at`) so middleware
 * stops bouncing them back to `/onboarding/plan`.
 *
 * No card is captured. We only set:
 *   - subscription_chosen_at = now()
 *   - subscription_chosen_plan = 'starter'
 *   - subscription_plan       = 'starter' (display key for plan-limits fallback)
 *
 * We deliberately do NOT change `subscription_status` — that stays driven by
 * Stripe webhooks for any user who later upgrades.
 */
export async function chooseStarterPlanAction(): Promise<ChooseStarterPlanResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { ok: false, error: "You need to be signed in to choose a plan." };
    }

    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("user_settings")
      .update({
        subscription_chosen_at: nowIso,
        subscription_chosen_plan: "starter",
        subscription_plan: "starter",
        updated_at: nowIso,
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("[chooseStarterPlanAction] update failed:", error.message);
      return { ok: false, error: "We couldn't save your plan choice. Please try again." };
    }

    revalidatePath("/onboarding");
    revalidatePath("/onboarding/plan");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/billing");

    return { ok: true };
  } catch (error) {
    console.error("[chooseStarterPlanAction] unexpected:", error);
    return { ok: false, error: "Something went wrong saving your plan choice." };
  }
}
