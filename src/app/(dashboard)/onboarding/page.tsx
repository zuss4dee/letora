export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getOnboardingStatusForGate, getUserSettings } from "@/lib/actions/user-settings";
import { syncLegacyOnboardingAfterTenantStepRemoved } from "@/lib/actions/user-onboarding";
import { isOnboardingMarkedComplete } from "@/lib/onboarding/status";
import { clampOnboardingStep } from "@/lib/onboarding/landlord-wizard";
import type { UserSettingsRow } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";
import { displayNameFromUserMetadata } from "@/lib/auth/profile-hints";

export const metadata = {
  title: "Welcome · Letora",
};

function initialProfileNames(
  settings: UserSettingsRow | null,
  user: { user_metadata?: Record<string, unknown> | null },
): { firstName: string; lastName: string } {
  const savedFirst = settings?.firstName?.trim() ?? "";
  const savedLast = settings?.lastName?.trim() ?? "";
  if (savedFirst || savedLast) return { firstName: savedFirst, lastName: savedLast };

  const fromLandlord = settings?.landlordName?.trim() ?? "";
  const hint = displayNameFromUserMetadata(user.user_metadata ?? undefined);
  const full = fromLandlord.length >= 2 ? fromLandlord : hint;
  const i = full.indexOf(" ");
  if (i === -1) {
    return { firstName: full.trim(), lastName: "" };
  }
  return { firstName: full.slice(0, i).trim(), lastName: full.slice(i + 1).trim() };
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
    redirect("/dashboard?postSetup=1");
  }

  const settings = await getUserSettings(user.id);

  const onboardingGate = await getOnboardingStatusForGate(user.id);
  // Only `onboarding_status === 'completed'` exits the wizard. Do not also require
  // workspace setup (names/properties): the 3-step flow hands users to dashboard/import
  // and the in-app checklist covers the rest — a stricter gate would trap returning users.
  if (isOnboardingMarkedComplete(onboardingGate)) {
    redirect("/dashboard?postSetup=1");
  }

  const { firstName, lastName } = initialProfileNames(settings, user);
  const orgName = (settings?.orgName?.trim() || settings?.businessName?.trim() || "").trim();
  const initialStep = clampOnboardingStep(settings?.onboardingStep ?? 1);

  return (
    <Suspense fallback={<div className="min-h-svh bg-background" aria-hidden />}>
      <OnboardingWizard
        initialStep={initialStep}
        initialOrgName={orgName}
        initialFirstName={firstName}
        initialLastName={lastName}
        initialLandlordType={settings?.landlordType ?? null}
        userEmail={user.email ?? undefined}
      />
    </Suspense>
  );
}
