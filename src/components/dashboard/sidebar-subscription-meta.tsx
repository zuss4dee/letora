import { SidebarPatch } from "@/components/dashboard/sidebar-dynamic-context";
import { getUserSettings } from "@/lib/actions/user-settings";
import { withTimeout } from "@/lib/async/with-timeout";

export async function SidebarSubscriptionMeta({ userId }: { userId: string }) {
  const settings = await withTimeout(getUserSettings(userId), 3000, null, "sidebar:subscription:getUserSettings");

  return (
    <SidebarPatch
      subscriptionPlan={settings?.subscriptionPlan ?? null}
      subscriptionStatus={settings?.subscriptionStatus ?? null}
      subscriptionPeriodEnd={settings?.subscriptionPeriodEnd ?? null}
      subscriptionTrialEnd={settings?.subscriptionTrialEnd ?? null}
    />
  );
}
