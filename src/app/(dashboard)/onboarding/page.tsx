export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getOnboardingStatusForGate, getUserSettings } from "@/lib/actions/user-settings";
import { syncLegacyOnboardingAfterTenantStepRemoved } from "@/lib/actions/user-onboarding";
import { isOnboardingMarkedComplete } from "@/lib/onboarding/status";
import type { OnboardingStatus } from "@/lib/onboarding/status";
import {
  LANDLORD_ONBOARDING_WIZARD_LAST_STEP_INDEX,
  type OnboardingWizardStep,
} from "@/lib/onboarding/landlord-wizard";
import type { UserSettingsRow } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";
import { displayNameFromUserMetadata } from "@/lib/auth/profile-hints";
import { isWorkspaceSetupIncomplete } from "@/lib/onboarding/workspace-setup";

export const metadata = {
  title: "Welcome · Letora",
};

/** Signup / OAuth metadata — pre-fills landlord name when not yet in `user_settings`. */
function landlordNameForOnboarding(
  settings: UserSettingsRow | null,
  user: { user_metadata?: Record<string, unknown> | null },
): string {
  const saved = settings?.landlordName?.trim() ?? "";
  if (saved.length >= 2) return saved;
  const hint = displayNameFromUserMetadata(user.user_metadata ?? undefined);
  return hint.length >= 2 ? hint : "";
}

function areSettingsEssentialsComplete(settings: UserSettingsRow | null): boolean {
  return Boolean(settings?.landlordName?.trim());
}

function inferInitialStep(
  status: OnboardingStatus,
  hasBusinessName: boolean,
  settingsComplete: boolean,
  propertyCount: number,
): OnboardingWizardStep {
  if (status === "settings_pending") return 2;
  if (status === "property_pending") {
    if (!settingsComplete) return 2;
    return LANDLORD_ONBOARDING_WIZARD_LAST_STEP_INDEX;
  }
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

  const legacy = await syncLegacyOnboardingAfterTenantStepRemoved();
  if (legacy.ok && legacy.didComplete) {
    redirect("/dashboard");
  }

  const settings = await getUserSettings(user.id);
  const status = settings?.onboardingStatus ?? "profile_pending";

  const { count: propertyCountRaw } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const propertyCount = propertyCountRaw ?? 0;

  const onboardingGate = await getOnboardingStatusForGate(user.id);
  if (
    isOnboardingMarkedComplete(onboardingGate) &&
    !isWorkspaceSetupIncomplete({
      landlordName: settings?.landlordName,
      propertyCount,
    })
  ) {
    redirect("/dashboard");
  }

  const hasBusinessName = Boolean(settings?.businessName?.trim());
  const defaultLandlordName = landlordNameForOnboarding(settings, user);
  const settingsComplete = areSettingsEssentialsComplete(settings);
  const initialStep = inferInitialStep(status, hasBusinessName, settingsComplete, propertyCount);

  return (
    <Suspense fallback={<div className="min-h-svh bg-zinc-950 dark:bg-black" aria-hidden />}>
      <OnboardingWizard
        initialStep={initialStep}
        defaultPortfolioName={settings?.businessName ?? ""}
        storedPrimaryGoal={settings?.onboardingPrimaryGoal ?? null}
        defaultLandlordName={defaultLandlordName}
        defaultContactEmail={settings?.contactEmail ?? ""}
        defaultReferencingAgencyEmail={settings?.referencingAgencyEmail ?? ""}
      />
    </Suspense>
  );
}
