/**
 * Landlord signup wizard — single source for step labels, count, and indices.
 * The last step submits via `completeOnboardingWithProperty` (`onboarding_status` → `completed`).
 */
export const LANDLORD_ONBOARDING_WIZARD_STEPS = [
  "Identity",
  "Priorities",
  "Landlord & agency",
  "First property",
] as const;

/** Zero-based index; keep in sync with `LANDLORD_ONBOARDING_WIZARD_STEPS.length`. */
export type OnboardingWizardStep = 0 | 1 | 2 | 3;

type _Expect<T extends true> = T;
type _landlordWizardStepsLength = _Expect<
  (typeof LANDLORD_ONBOARDING_WIZARD_STEPS)["length"] extends 4 ? true : false
>;

export const LANDLORD_ONBOARDING_WIZARD_STEP_COUNT = LANDLORD_ONBOARDING_WIZARD_STEPS.length;

export const LANDLORD_ONBOARDING_WIZARD_LAST_STEP_INDEX = (
  LANDLORD_ONBOARDING_WIZARD_STEP_COUNT - 1
) as OnboardingWizardStep;
