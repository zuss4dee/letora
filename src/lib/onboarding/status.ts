export type OnboardingStatus =
  | "profile_pending"
  | "settings_pending"
  | "property_pending"
  | "completed";

/** Raw `user_settings.onboarding_status` value — not a Server Action (pure helper). */
export function isOnboardingMarkedComplete(status: string | null | undefined): boolean {
  return typeof status === "string" && status.trim() === "completed";
}

export function parseOnboardingStatus(raw: unknown): OnboardingStatus {
  const s = typeof raw === "string" ? raw.trim() : "";
  // Legacy value before migration 20260523120000; treat as first-property step.
  if (s === "tenant_pending") return "property_pending";
  if (
    s === "profile_pending" ||
    s === "settings_pending" ||
    s === "property_pending" ||
    s === "completed"
  ) {
    return s;
  }
  return "profile_pending";
}
