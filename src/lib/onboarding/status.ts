export type OnboardingStatus = "profile_pending" | "property_pending" | "completed";

/** Raw `user_settings.onboarding_status` value — not a Server Action (pure helper). */
export function isOnboardingMarkedComplete(status: string | null | undefined): boolean {
  return typeof status === "string" && status.trim() === "completed";
}

export function parseOnboardingStatus(raw: unknown): OnboardingStatus {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "profile_pending" || s === "property_pending" || s === "completed") return s;
  return "profile_pending";
}
