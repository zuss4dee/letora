"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import {
  saveOrganisationSection,
  uploadOrgLogo,
} from "@/app/(dashboard)/dashboard/settings/actions";
import { SettingsSaveButton, type SaveStatus } from "@/components/settings/settings-save-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  organisationSettingsSchema,
  type OrganisationSettingsInput,
} from "@/lib/validations/user-settings";
import { cn } from "@/lib/utils";

type Props = {
  initialValues: OrganisationSettingsInput;
  onDirtyChange?: (dirty: boolean) => void;
};

const FIELD_LABEL = "text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const FIELD_HELP = "text-xs text-zinc-500 dark:text-zinc-500";

export function OrganisationSettings({ initialValues, onDirtyChange }: Props) {
  const form = useForm<OrganisationSettingsInput>({
    resolver: zodResolver(organisationSettingsSchema),
    defaultValues: initialValues,
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [logoPreview, setLogoPreview] = useState<string>(initialValues.orgLogoUrl ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function onSubmit(values: OrganisationSettingsInput) {
    setStatus("loading");
    const result = await saveOrganisationSection({ ...values, orgLogoUrl: logoPreview });
    if (!result.ok) {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2000);
      return;
    }
    setStatus("success");
    form.reset({ ...values, orgLogoUrl: logoPreview });
    window.setTimeout(() => setStatus("idle"), 2000);
  }

  function handlePickLogo() {
    fileInputRef.current?.click();
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const result = await uploadOrgLogo(fd);
      if (result.ok === false) {
        setUploadError(result.error);
        return;
      }
      setLogoPreview(result.url);
      form.setValue("orgLogoUrl", result.url, { shouldDirty: true });
    });
    event.target.value = "";
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Organisation</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Public details that appear on tenant-facing emails, contracts, and listings.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="org-logo" className={FIELD_LABEL}>
              Organisation logo
            </Label>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-[#2a2a2a] dark:bg-[#0e0e0e]">
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt="Organisation logo preview"
                    width={80}
                    height={80}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    No logo
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={handlePickLogo}
                  disabled={isUploading}
                  className={cn(
                    "inline-flex h-9 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-[#2a2a2a] dark:bg-transparent dark:text-zinc-100 dark:hover:bg-[#1f1f1f]",
                  )}
                >
                  {isUploading ? "Uploading…" : logoPreview ? "Replace logo" : "Upload logo"}
                </button>
                <p className={FIELD_HELP}>PNG, JPEG, or SVG. Max 2MB. Recommended 256×256.</p>
                {uploadError ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
                ) : null}
              </div>
              <input
                id="org-logo"
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-name" className={FIELD_LABEL}>
              Organisation name
            </Label>
            <Input
              id="org-name"
              placeholder="e.g. Smith Lettings Ltd"
              {...form.register("orgName")}
            />
            <p className={FIELD_HELP}>Shown to tenants in emails and on listings.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-contact-email" className={FIELD_LABEL}>
                Contact email
              </Label>
              <Input
                id="org-contact-email"
                type="email"
                placeholder="hello@yourcompany.co.uk"
                {...form.register("orgContactEmail")}
              />
              <p className={FIELD_HELP}>Public address tenants can reply to.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone" className={FIELD_LABEL}>
                Phone number
              </Label>
              <Input
                id="org-phone"
                type="tel"
                placeholder="+44 20 1234 5678"
                {...form.register("orgPhone")}
              />
              <p className={FIELD_HELP}>Optional — included on contracts and listings.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-address" className={FIELD_LABEL}>
              Business address
            </Label>
            <Textarea
              id="org-address"
              rows={3}
              placeholder="123 Letting Street, London, EC1A 1AA"
              {...form.register("orgAddress")}
            />
            <p className={FIELD_HELP}>Required for the legal footer on UK tenancy contracts.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-stretch justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-[#2a2a2a] sm:flex-row sm:items-center">
        <SettingsSaveButton status={status} disabled={!dirty && status === "idle"} />
      </div>
    </form>
  );
}
