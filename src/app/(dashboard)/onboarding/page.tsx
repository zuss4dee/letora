import { Suspense } from "react";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getOnboardingStatusForGate, getUserSettings } from "@/lib/actions/user-settings";
import { isOnboardingMarkedComplete } from "@/lib/onboarding/status";
import type { OnboardingStatus } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Welcome · Letora",
};

function inferInitialStep(
  status: OnboardingStatus,
  hasBusinessName: boolean,
): 0 | 1 | 2 {
  if (status === "property_pending") return 2;
  if (status === "profile_pending" && hasBusinessName) return 1;
  return 0;
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const onboardingGate = await getOnboardingStatusForGate(user.id);
  if (isOnboardingMarkedComplete(onboardingGate)) {
    redirect("/dashboard");
  }

  const settings = await getUserSettings(user.id);
  const status = settings?.onboardingStatus ?? "profile_pending";

  const hasBusinessName = Boolean(settings?.businessName?.trim());
  const initialStep = inferInitialStep(status, hasBusinessName);

  return (
    <Suspense fallback={<div className="min-h-svh bg-black" aria-hidden />}>
      <OnboardingWizard
        initialStep={initialStep}
        defaultPortfolioName={settings?.businessName ?? ""}
        storedPrimaryGoal={settings?.onboardingPrimaryGoal ?? null}
      />
    </Suspense>
  );
}
