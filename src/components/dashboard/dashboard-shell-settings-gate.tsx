import { redirect } from "next/navigation";

import { SidebarPatch } from "@/components/dashboard/sidebar-dynamic-context";
import { isOnboardingMarkedComplete } from "@/lib/onboarding/status";
import { withTimeout } from "@/lib/async/with-timeout";
import { getDashboardShellUserSettingsSliceCached } from "@/lib/dashboard/cached-shell-reads";

const DASHBOARD_SHELL_FETCH_MS = 6000;

/**
 * One narrow `user_settings` fetch for (1) onboarding gate and (2) sidebar subscription chip.
 * Avoids parallel full + minimal reads on every dashboard paint.
 */
export async function DashboardShellSettingsGate({ userId }: { userId: string }) {
  const row = await withTimeout(
    getDashboardShellUserSettingsSliceCached(userId),
    DASHBOARD_SHELL_FETCH_MS,
    null,
    "dashboard-shell:userSettingsSlice",
  );

  // Timeout / error: neutral — mirror prior gate semantics (don't redirect blindly).
  if (row === null) {
    return null;
  }

  const gate = row.onboardingStatus ?? null;

  // Match OnboardingGateBoundary: unset status → skip redirect.
  if (gate != null && !isOnboardingMarkedComplete(gate)) {
    redirect("/onboarding");
  }

  return (
    <SidebarPatch
      subscriptionPlan={row.subscriptionPlan}
      subscriptionStatus={row.subscriptionStatus}
      subscriptionPeriodEnd={row.subscriptionPeriodEnd}
      subscriptionTrialEnd={row.subscriptionTrialEnd}
      polarBillingLinked={row.polarBillingLinked}
    />
  );
}
