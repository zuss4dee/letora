import { Suspense } from "react";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getOnboardingStatusForGate, getUserSettings } from "@/lib/actions/user-settings";
import { isOnboardingMarkedComplete } from "@/lib/onboarding/status";
import type { OnboardingStatus } from "@/lib/onboarding/status";
import type { OnboardingWizardStep } from "@/components/onboarding/onboarding-wizard";
import type { UserSettingsRow } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Welcome · Letora",
};

function areSettingsEssentialsComplete(settings: UserSettingsRow | null): boolean {
  return Boolean(
    settings?.landlordName?.trim() &&
      settings?.contactEmail?.trim() &&
      settings?.referencingAgencyEmail?.trim(),
  );
}

function inferInitialStep(
  status: OnboardingStatus,
  hasBusinessName: boolean,
  settingsComplete: boolean,
): OnboardingWizardStep {
  if (status === "tenant_pending") return 4;
  if (status === "property_pending") {
    if (!settingsComplete) return 2;
    return 3;
  }
  if (status === "settings_pending") return 2;
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
  const settingsComplete = areSettingsEssentialsComplete(settings);
  const initialStep = inferInitialStep(status, hasBusinessName, settingsComplete);

  return (
    <Suspense fallback={<div className="min-h-svh bg-black" aria-hidden />}>
      <OnboardingWizard
        initialStep={initialStep}
        defaultPortfolioName={settings?.businessName ?? ""}
        storedPrimaryGoal={settings?.onboardingPrimaryGoal ?? null}
        defaultLandlordName={settings?.landlordName ?? ""}
        defaultContactEmail={settings?.contactEmail ?? ""}
        defaultReferencingAgencyEmail={settings?.referencingAgencyEmail ?? ""}
      />
    </Suspense>
  );
}
