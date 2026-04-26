import { redirect } from "next/navigation";

import { getOnboardingStatusForGate } from "@/lib/actions/user-settings";
import { isOnboardingMarkedComplete } from "@/lib/onboarding/status";
import { withTimeout } from "@/lib/async/with-timeout";

/**
 * Isolated onboarding gate: runs after shell streams; slow/failed reads must not blank the dashboard.
 */
export async function OnboardingGateBoundary({ userId }: { userId: string }) {
  const onboardingGate = await withTimeout(
    getOnboardingStatusForGate(userId),
    3000,
    null,
    "onboarding:getOnboardingStatusForGate",
  );

  // Unknown (timeout/error): do not redirect — avoids false positives when the gate read fails.
  if (onboardingGate == null) {
    return null;
  }

  if (!isOnboardingMarkedComplete(onboardingGate)) {
    redirect("/onboarding");
  }

  return null;
}
