"use server";

import { revalidatePath } from "next/cache";

import {
  saveAiChaseSettings as persistAiChaseSettings,
  saveAppearanceSettings as persistAppearanceSettings,
  saveEmailTemplatesSettings as persistEmailTemplatesSettings,
  saveNotificationSettings as persistNotificationSettings,
  saveOrganisationSettings as persistOrganisationSettings,
  saveProfileSettings as persistProfileSettings,
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

export type SettingsSaveResult = { success: true } | { success: false; error: string };

function mapOk(r: { ok: true } | { ok: false; error: string }): SettingsSaveResult {
  if (r.ok === false) {
    return { success: false, error: r.error };
  }
  return { success: true };
}

export async function saveOrganisationSettings(input: OrganisationSettingsInput): Promise<SettingsSaveResult> {
  return mapOk(await persistOrganisationSettings(input));
}

export async function saveProfileSettings(input: ProfileSettingsInput): Promise<SettingsSaveResult> {
  return mapOk(await persistProfileSettings(input));
}

export async function saveAIChaseSettings(input: AiChaseSettingsInput): Promise<SettingsSaveResult> {
  return mapOk(await persistAiChaseSettings(input));
}

export async function saveEmailTemplateSettings(
  input: EmailTemplatesSettingsInput,
): Promise<SettingsSaveResult> {
  return mapOk(await persistEmailTemplatesSettings(input));
}

export async function saveNotificationSettings(
  input: NotificationSettingsInput,
): Promise<SettingsSaveResult> {
  return mapOk(await persistNotificationSettings(input));
}

export async function saveAppearanceSettings(input: AppearanceSettingsInput): Promise<SettingsSaveResult> {
  return mapOk(await persistAppearanceSettings(input));
}

/** @deprecated Use named exports above — kept for any stale imports. */
export const saveOrganisationSection = saveOrganisationSettings;
export const saveProfileSection = saveProfileSettings;
export const saveAiChaseSection = saveAIChaseSettings;
export const saveEmailTemplatesSection = saveEmailTemplateSettings;
export const saveNotificationSection = saveNotificationSettings;
export const saveAppearanceSection = saveAppearanceSettings;

/* -------------------------------------------------------------------------- */
/* Image uploads (logo + avatar) — public bucket, RLS scoped by auth.uid().   */
/* -------------------------------------------------------------------------- */

const IMAGE_TYPES_ORG = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const IMAGE_TYPES_AVATAR = new Set(["image/png", "image/jpeg"]);

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

type AssetUploadResult = { success: true; url: string } | { success: false; error: string };

async function uploadUserAsset(file: File, kind: "logo" | "avatar"): Promise<AssetUploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const allowed = kind === "logo" ? IMAGE_TYPES_ORG : IMAGE_TYPES_AVATAR;
  if (!allowed.has(file.type)) {
    const friendlyTypes = kind === "logo" ? "PNG, JPEG, or SVG" : "PNG or JPEG";
    return { success: false, error: `Use a ${friendlyTypes} image.` };
  }

  const maxBytes = (kind === "logo" ? 2 : 1) * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      success: false,
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
      success: false,
      error: userFacingError(upErr.message, "We couldn't upload that image. Please try again."),
    };
  }

  const { data: pub } = supabase.storage.from(USER_ASSETS_BUCKET).getPublicUrl(path);
  if (!pub.publicUrl) {
    return { success: false, error: "Image uploaded but the URL could not be resolved." };
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
      success: false,
      error: userFacingError(updErr.message, "We saved the file but couldn't link it to your settings."),
    };
  }

  revalidatePath("/dashboard/settings");
  return { success: true, url: pub.publicUrl };
}

export async function uploadOrgLogo(formData: FormData): Promise<AssetUploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose a file to upload." };
  }
  return uploadUserAsset(file, "logo");
}

export async function uploadProfileAvatar(formData: FormData): Promise<AssetUploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose a file to upload." };
  }
  return uploadUserAsset(file, "avatar");
}

export async function uploadFile(
  formData: FormData,
  type: "logo" | "avatar",
): Promise<AssetUploadResult> {
  if (type === "logo") return uploadOrgLogo(formData);
  return uploadProfileAvatar(formData);
}

/* -------------------------------------------------------------------------- */
/* Password change via Supabase Auth.                                         */
/* -------------------------------------------------------------------------- */

export type ChangePasswordResult =
  | { success: true }
  | {
      success: false;
      error: string;
      field?: "currentPassword" | "newPassword" | "confirmPassword" | null;
    };

export async function changePassword(input: PasswordChangeInput): Promise<ChangePasswordResult> {
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: issue?.message ?? "Invalid password input.",
      field: (issue?.path?.[0] ?? null) as "currentPassword" | "newPassword" | "confirmPassword" | null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { success: false, error: "Not authenticated", field: null };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (signInError) {
    return {
      success: false,
      error: "Current password is incorrect.",
      field: "currentPassword",
    };
  }

  const { error: updErr } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (updErr) {
    return {
      success: false,
      error: userFacingError(updErr.message, "We couldn't update your password. Please try again."),
      field: null,
    };
  }

  return { success: true };
}
