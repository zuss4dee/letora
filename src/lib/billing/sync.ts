import { createServiceRoleClient } from "@/lib/supabase/admin";
import { PLANS, type PlanKey } from "@/lib/stripe-plans";

export type BillingSyncData = {
  userId: string;
  provider: "stripe" | "polar";
  subscriptionId: string;
  customerId: string;
  status: string;
  planKey: PlanKey | null;
  periodEnd: Date;
  trialEnd?: Date | null;
};

/**
 * Shared helper to synchronize billing status from any provider to the user_settings table.
 */
export async function syncSubscriptionToUserSettings(
  supabase: ReturnType<typeof createServiceRoleClient>,
  data: BillingSyncData
) {
  const {
    userId,
    provider,
    subscriptionId,
    customerId,
    status,
    planKey,
    periodEnd,
    trialEnd,
  } = data;

  const subscription_plan = planKey ? PLANS[planKey].name : null;

  const updateData: any = {
    subscription_status: status,
    subscription_plan,
    subscription_period_end: periodEnd.toISOString(),
    subscription_trial_end: status === "trialing" ? trialEnd?.toISOString() ?? null : null,
    updated_at: new Date().toISOString(),
  };

  if (provider === "stripe") {
    updateData.stripe_subscription_id = subscriptionId;
    updateData.stripe_customer_id = customerId;
  } else {
    updateData.polar_subscription_id = subscriptionId;
    updateData.polar_customer_id = customerId;
  }

  const { error } = await supabase
    .from("user_settings")
    .update(updateData)
    .eq("user_id", userId);

  if (error) {
    console.error(`[syncSubscriptionToUserSettings] Failed for ${provider}:`, error.message);
    throw error;
  }
}
