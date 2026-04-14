import type { User } from "@supabase/supabase-js";

import type { UserSettingsInput } from "@/lib/validations/user-settings";

/** Best-effort display name from Supabase Auth `user_metadata` (signup, OAuth, etc.). */
export function displayNameFromUserMetadata(meta: Record<string, unknown> | null | undefined): string {
  if (!meta || typeof meta !== "object") return "";

  const given = meta.given_name;
  const family = meta.family_name;
  const combined =
    typeof given === "string" && typeof family === "string"
      ? `${given.trim()} ${family.trim()}`.trim()
      : "";

  const candidates = [
    meta.full_name,
    meta.fullName,
    meta.name,
    meta.display_name,
    meta.displayName,
    combined.length >= 2 ? combined : "",
  ];

  for (const c of candidates) {
    if (typeof c === "string") {
      const t = c.trim();
      if (t.length >= 2) return t;
    }
  }
  return "";
}

/** Fill empty landlord / contact fields from the signed-in user when DB row has no values yet. */
export function mergeSettingsWithAuthHints(values: UserSettingsInput, user: User | null): UserSettingsInput {
  const next = { ...values };
  if (!user) return next;

  const meta =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : undefined;
  const nameHint = displayNameFromUserMetadata(meta);
  const emailHint = user.email?.trim() ?? "";

  if (!next.landlordName?.trim() && nameHint) next.landlordName = nameHint;
  if (!next.contactEmail?.trim() && emailHint) next.contactEmail = emailHint;

  return next;
}
