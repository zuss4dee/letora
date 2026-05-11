"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import {
  changePassword,
  saveProfileSettings,
  uploadProfileAvatar,
} from "@/app/(dashboard)/dashboard/settings/actions";
import { SettingsSaveButton, type SaveStatus } from "@/components/settings/settings-save-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  passwordChangeSchema,
  profileSettingsSchema,
  type PasswordChangeInput,
  type ProfileSettingsInput,
} from "@/lib/validations/user-settings";
import { cn } from "@/lib/utils";

type Props = {
  initialValues: ProfileSettingsInput;
  authEmail: string;
  onDirtyChange?: (dirty: boolean) => void;
};

const FIELD_LABEL = "text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const FIELD_HELP = "text-xs text-zinc-500 dark:text-zinc-500";

const MAX_AVATAR_BYTES = 1 * 1024 * 1024;

export function ProfileSettings({ initialValues, authEmail, onDirtyChange }: Props) {
  const form = useForm<ProfileSettingsInput>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: initialValues,
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(initialValues.avatarUrl ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const dirty = form.formState.isDirty;

  const passwordForm = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const [passwordStatus, setPasswordStatus] = useState<SaveStatus>("idle");
  const [passwordServerError, setPasswordServerError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const passwordDirty = passwordForm.formState.isDirty;

  useEffect(() => {
    onDirtyChange?.(dirty || passwordDirty);
  }, [dirty, passwordDirty, onDirtyChange]);

  function handlePickAvatar() {
    fileInputRef.current?.click();
  }

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_AVATAR_BYTES) {
      setUploadError("File must be under 1MB");
      event.target.value = "";
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const result = await uploadProfileAvatar(fd);
      if (result.success === false) {
        setUploadError(result.error);
        return;
      }
      setAvatarPreview(result.url);
      form.setValue("avatarUrl", result.url, { shouldDirty: true });
    });
    event.target.value = "";
  }

  async function onSubmit(values: ProfileSettingsInput) {
    setSaveError(null);
    setStatus("loading");
    const result = await saveProfileSettings({ ...values, avatarUrl: avatarPreview });
    if (result.success === false) {
      setSaveError(result.error);
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 3000);
      return;
    }
    setStatus("success");
    form.reset({ ...values, avatarUrl: avatarPreview });
    window.setTimeout(() => setStatus("idle"), 2000);
  }

  async function onPasswordSubmit(values: PasswordChangeInput) {
    setPasswordServerError(null);
    setPasswordSuccess(false);
    setPasswordStatus("loading");
    const result = await changePassword(values);
    if (result.success === false) {
      setPasswordStatus("error");
      if (result.field) {
        passwordForm.setError(result.field, { message: result.error });
      } else {
        setPasswordServerError(result.error);
      }
      window.setTimeout(() => setPasswordStatus("idle"), 3000);
      return;
    }
    setPasswordStatus("success");
    setPasswordSuccess(true);
    passwordForm.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
    window.setTimeout(() => {
      setPasswordStatus("idle");
      setPasswordSuccess(false);
    }, 2000);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Profile</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Personal details for your account. Shown to your team and used as your sign-off on emails.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="profile-avatar" className={FIELD_LABEL}>
                Avatar
              </Label>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-50 dark:border-[#2a2a2a] dark:bg-[#0e0e0e]">
                  {avatarPreview ? (
                    <Image
                      src={avatarPreview}
                      alt="Avatar preview"
                      width={80}
                      height={80}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      No image
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={handlePickAvatar}
                    disabled={isUploading}
                    className={cn(
                      "inline-flex h-9 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-[#2a2a2a] dark:bg-transparent dark:text-zinc-100 dark:hover:bg-[#1f1f1f]",
                    )}
                  >
                    {isUploading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-white" />
                        Uploading…
                      </span>
                    ) : avatarPreview ? (
                      "Replace photo"
                    ) : (
                      "Upload photo"
                    )}
                  </button>
                  <p className={FIELD_HELP}>PNG or JPEG. Max 1MB.</p>
                  {uploadError ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
                  ) : null}
                </div>
                <input
                  id="profile-avatar"
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first-name" className={FIELD_LABEL}>
                  First name
                </Label>
                <Input id="first-name" {...form.register("firstName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name" className={FIELD_LABEL}>
                  Last name
                </Label>
                <Input id="last-name" {...form.register("lastName")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email" className={FIELD_LABEL}>
                Email address
              </Label>
              <Input id="profile-email" type="email" value={authEmail} readOnly disabled className="opacity-80" />
              <p className={FIELD_HELP}>This is your login email.</p>
            </div>
          </div>
        </div>

        {saveError ? (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {saveError}
          </p>
        ) : null}

        <div className="flex flex-col items-stretch justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-[#2a2a2a] sm:flex-row sm:items-center">
          <SettingsSaveButton status={status} disabled={!dirty && status === "idle"} />
        </div>
      </form>

      <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Change password</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Use a unique password you don&apos;t use anywhere else. Minimum 8 characters.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="current-password" className={FIELD_LABEL}>
                Current password
              </Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register("currentPassword")}
              />
              {passwordForm.formState.errors.currentPassword?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password" className={FIELD_LABEL}>
                New password
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("newPassword")}
              />
              {passwordForm.formState.errors.newPassword?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className={FIELD_LABEL}>
                Confirm new password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("confirmPassword")}
              />
              {passwordForm.formState.errors.confirmPassword?.message ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
          </div>
          {passwordServerError ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {passwordServerError}
            </p>
          ) : null}
          {passwordSuccess ? (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400" role="status">
              Password updated
            </p>
          ) : null}
          <div className="mt-6 flex flex-col items-stretch justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-[#2a2a2a] sm:flex-row sm:items-center">
            <SettingsSaveButton
              status={passwordStatus}
              disabled={!passwordDirty && passwordStatus === "idle"}
              idleLabel="Save password"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
