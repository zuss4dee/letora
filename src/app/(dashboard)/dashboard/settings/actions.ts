"use server";

import { revalidatePath } from "next/cache";

import {
  saveAiChaseSettings as libSaveAiChase,
  saveAppearanceSettings as libSaveAppearance,
  saveEmailTemplatesSettings as libSaveEmail,
  saveNotificationSettings as libSaveNotifications,
  saveOrganisationSettings as libSaveOrg,
  saveProfileSettings as libSaveProfile,
} from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";
import { userFacingError } from "@/lib/user-facing-errors";
import {
  type AiChaseSettingsInput,
  type AppearanceSettingsInput,
  type EmailTemplatesSettingsInput,
  type NotificationSettingsInput,
  type OrganisationSettingsInput,
  type PasswordChangeInput,
  passwordChangeSchema,
  type ProfileSettingsInput,
} from "@/lib/validations/user-settings";

const USER_ASSETS_BUCKET = "user-assets";

/** Per-section save wrappers — components in this folder import from here so the
 *  page-level boundary is clear, while the persistence logic lives in
 *  `src/lib/actions/user-settings.ts` next to the rest of the user-settings code. */
export async function saveOrganisationSection(input: OrganisationSettingsInput) {
  return libSaveOrg(input);
}

export async function saveProfileSection(input: ProfileSettingsInput) {
  return libSaveProfile(input);
}

export async function saveAiChaseSection(input: AiChaseSettingsInput) {
  return libSaveAiChase(input);
}

export async function saveEmailTemplatesSection(input: EmailTemplatesSettingsInput) {
  return libSaveEmail(input);
}

export async function saveNotificationSection(input: NotificationSettingsInput) {
  return libSaveNotifications(input);
}

export async function saveAppearanceSection(input: AppearanceSettingsInput) {
  return libSaveAppearance(input);
}

/* -------------------------------------------------------------------------- */
/* Image uploads (logo + avatar) — public bucket, RLS scoped by auth.uid().   */
/* -------------------------------------------------------------------------- */

const IMAGE_TYPES_ORG = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const IMAGE_TYPES_AVATAR = new Set(["image/png", "image/jpeg"]);

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

type AssetUploadResult = { ok: true; url: string } | { ok: false; error: string };

async function uploadUserAsset(
  file: File,
  kind: "logo" | "avatar",
): Promise<AssetUploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const allowed = kind === "logo" ? IMAGE_TYPES_ORG : IMAGE_TYPES_AVATAR;
  if (!allowed.has(file.type)) {
    const friendlyTypes = kind === "logo" ? "PNG, JPEG, or SVG" : "PNG or JPEG";
    return { ok: false, error: `Use a ${friendlyTypes} image.` };
  }

  const maxBytes = (kind === "logo" ? 2 : 1) * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `Image is too large. Keep it under ${kind === "logo" ? "2MB" : "1MB"}.`,
    };
  }

  const safe = sanitizeFilename(file.name || `${kind}.png`);
  const path = `${user.id}/${kind}/${Date.now()}-${safe}`;

  const { error: upErr } = await supabase.storage.from(USER_ASSETS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) {
    return {
      ok: false,
      error: userFacingError(upErr.message, "We couldn't upload that image. Please try again."),
    };
  }

  const { data: pub } = supabase.storage.from(USER_ASSETS_BUCKET).getPublicUrl(path);
  if (!pub.publicUrl) {
    return { ok: false, error: "Image uploaded but the URL could not be resolved." };
  }

  const column = kind === "logo" ? "org_logo_url" : "avatar_url";
  const { error: updErr } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, [column]: pub.publicUrl, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (updErr) {
    return {
      ok: false,
      error: userFacingError(updErr.message, "We saved the file but couldn't link it to your settings."),
    };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, url: pub.publicUrl };
}

export async function uploadOrgLogo(formData: FormData): Promise<AssetUploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  return uploadUserAsset(file, "logo");
}

export async function uploadProfileAvatar(formData: FormData): Promise<AssetUploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  return uploadUserAsset(file, "avatar");
}

/* -------------------------------------------------------------------------- */
/* Password change via Supabase Auth.                                         */
/* -------------------------------------------------------------------------- */

export async function changePassword(input: PasswordChangeInput) {
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false as const,
      error: issue?.message ?? "Invalid password input.",
      field: (issue?.path?.[0] ?? null) as "currentPassword" | "newPassword" | "confirmPassword" | null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { ok: false as const, error: "Not authenticated", field: null };
  }

  /** Re-authenticate with the current password before changing it. */
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (signInError) {
    return {
      ok: false as const,
      error: "Current password is incorrect.",
      field: "currentPassword" as const,
    };
  }

  const { error: updErr } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (updErr) {
    return {
      ok: false as const,
      error: userFacingError(updErr.message, "We couldn't update your password. Please try again."),
      field: null,
    };
  }

  return { ok: true as const };
}
