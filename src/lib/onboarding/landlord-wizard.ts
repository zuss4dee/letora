/**
 * Landlord onboarding wizard — step labels and landlord segment enum (DB + UI).
 */

export const LANDLORD_ONBOARDING_WIZARD_STEPS = [
  "Profile & organisation",
  "How you operate",
  "Get started",
] as const;

/** One-based step index (matches `user_settings.onboarding_step`). */
export type OnboardingWizardStep = 1 | 2 | 3;

export const LANDLORD_ONBOARDING_WIZARD_STEP_COUNT = LANDLORD_ONBOARDING_WIZARD_STEPS.length;

export const LANDLORD_TYPE_VALUES = ["self_managed", "portfolio", "agent", "new_landlord"] as const;
export type LandlordType = (typeof LANDLORD_TYPE_VALUES)[number];

export function parseLandlordType(raw: unknown): LandlordType | null {
  if (typeof raw !== "string") return null;
  return (LANDLORD_TYPE_VALUES as readonly string[]).includes(raw) ? (raw as LandlordType) : null;
}

export function clampOnboardingStep(n: number): OnboardingWizardStep {
  if (!Number.isFinite(n)) return 1;
  const r = Math.round(n);
  if (r < 1) return 1;
  if (r > 3) return 3;
  return r as OnboardingWizardStep;
}
