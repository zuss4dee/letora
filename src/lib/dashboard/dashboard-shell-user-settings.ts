import { createClient } from "@/lib/supabase/server";

export type DashboardShellUserSettingsSlice = {
  onboardingStatus: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: string | null;
  subscriptionTrialEnd: string | null;
};

/** Single narrow read for dashboard shell onboarding gate + sidebar subscription stripe. */
export async function getDashboardShellUserSettingsSlice(
  userId: string,
): Promise<DashboardShellUserSettingsSlice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select(
      "onboarding_status, subscription_plan, subscription_status, subscription_period_end, subscription_trial_end",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getDashboardShellUserSettingsSlice]", error.message);
    return null;
  }
  if (!data) return null;

  const raw = data.onboarding_status as string | null | undefined;
  const onboardingStatus = typeof raw === "string" ? raw : null;

  return {
    onboardingStatus,
    subscriptionPlan: (data.subscription_plan as string | null) ?? null,
    subscriptionStatus: (data.subscription_status as string | null) ?? null,
    subscriptionPeriodEnd: (data.subscription_period_end as string | null) ?? null,
    subscriptionTrialEnd: (data.subscription_trial_end as string | null) ?? null,
  };
}
