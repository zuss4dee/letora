"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { saveEmailTemplateSettings } from "@/app/(dashboard)/dashboard/settings/actions";
import { SettingsSaveButton, type SaveStatus } from "@/components/settings/settings-save-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CHASE_EMAIL_DEFAULTS } from "@/lib/settings/email-template-defaults";
import {
  emailTemplatesSettingsSchema,
  type EmailTemplatesSettingsInput,
} from "@/lib/validations/user-settings";
import { cn } from "@/lib/utils";

type Props = {
  initialValues: EmailTemplatesSettingsInput;
  onDirtyChange?: (dirty: boolean) => void;
};

const FIELD_LABEL = "text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const FIELD_HELP = "text-xs text-zinc-500 dark:text-zinc-500";

const VARIABLES: ReadonlyArray<{ token: string; description: string }> = [
  { token: "{{tenant_name}}", description: "Tenant name" },
  { token: "{{property_address}}", description: "Property address" },
  { token: "{{amount_due}}", description: "Amount due" },
  { token: "{{due_date}}", description: "Due date" },
  { token: "{{days_overdue}}", description: "Days overdue" },
  { token: "{{landlord_name}}", description: "Your name" },
  { token: "{{org_name}}", description: "Organisation name" },
];

type ChaseField = "emailChase1" | "emailChase2" | "emailChase3";

const CHASE_STEPS: Array<{ step: 1 | 2 | 3; field: ChaseField; label: string }> = [
  { step: 1, field: "emailChase1", label: "Chase 1 — Friendly reminder" },
  { step: 2, field: "emailChase2", label: "Chase 2 — Firm follow-up" },
  { step: 3, field: "emailChase3", label: "Chase 3 — Formal notice" },
];

export function EmailTemplateSettings({ initialValues, onDirtyChange }: Props) {
  const form = useForm<EmailTemplatesSettingsInput>({
    resolver: zodResolver(emailTemplatesSettingsSchema),
    defaultValues: initialValues,
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{ field: ChaseField; step: 1 | 2 | 3 } | null>(null);

  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function onSubmit(values: EmailTemplatesSettingsInput) {
    setSaveError(null);
    setStatus("loading");
    const result = await saveEmailTemplateSettings(values);
    if (result.success === false) {
      setSaveError(result.error);
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 3000);
      return;
    }
    setStatus("success");
    form.reset(values);
    window.setTimeout(() => setStatus("idle"), 2000);
  }

  function insertVariable(field: ChaseField, token: string) {
    const fieldName = `${field}Body` as keyof EmailTemplatesSettingsInput;
    const textarea = document.getElementById(`${field}-body`) as HTMLTextAreaElement | null;
    const current = (form.getValues(fieldName) as string | undefined) ?? "";
    if (!textarea) {
      form.setValue(fieldName, `${current}${token}`, { shouldDirty: true });
      return;
    }
    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    form.setValue(fieldName, next, { shouldDirty: true });
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + token.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function applyReset(field: ChaseField, step: 1 | 2 | 3) {
    const subjectKey = `${field}Subject` as keyof EmailTemplatesSettingsInput;
    const bodyKey = `${field}Body` as keyof EmailTemplatesSettingsInput;
    const d = CHASE_EMAIL_DEFAULTS[step];
    form.setValue(subjectKey, d.subject, { shouldDirty: true });
    form.setValue(bodyKey, d.body, { shouldDirty: true });
    setResetTarget(null);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Email templates</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Customise the emails the AI uses as a base when drafting rent chase messages.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Sender details</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Shown in the From and Reply-To headers of chase emails.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email-sender-name" className={FIELD_LABEL}>
              Sender name
            </Label>
            <Input id="email-sender-name" {...form.register("emailSenderName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-reply-to" className={FIELD_LABEL}>
              Reply-to email
            </Label>
            <Input id="email-reply-to" type="email" {...form.register("emailReplyTo")} />
            {form.formState.errors.emailReplyTo?.message ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {form.formState.errors.emailReplyTo.message}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {CHASE_STEPS.map(({ step, field, label }) => {
        const subjectKey = `${field}Subject` as keyof EmailTemplatesSettingsInput;
        const bodyKey = `${field}Body` as keyof EmailTemplatesSettingsInput;
        return (
          <div
            key={field}
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{label}</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Variables are replaced when the email is sent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget({ field, step })}
                className={cn(
                  "inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-[#2a2a2a] dark:bg-transparent dark:text-zinc-100 dark:hover:bg-[#1f1f1f]",
                )}
              >
                Reset to default
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${field}-subject`} className={FIELD_LABEL}>
                  Subject line
                </Label>
                <Input id={`${field}-subject`} {...form.register(subjectKey)} />
              </div>
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor={`${field}-body`} className={FIELD_LABEL}>
                    Email body
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map((variable) => (
                      <button
                        key={`${field}-${variable.token}`}
                        type="button"
                        onClick={() => insertVariable(field, variable.token)}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-[#2a2a2a] dark:bg-[#0e0e0e] dark:text-zinc-300 dark:hover:bg-[#1f1f1f]"
                        title={variable.description}
                      >
                        {variable.token}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  id={`${field}-body`}
                  rows={8}
                  {...form.register(bodyKey)}
                  className="font-mono text-sm leading-relaxed"
                />
                <p className={FIELD_HELP}>Click a variable to insert it at the cursor.</p>
              </div>
            </div>
          </div>
        );
      })}

      {saveError ? (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="flex flex-col items-stretch justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-[#2a2a2a] sm:flex-row sm:items-center">
        <SettingsSaveButton status={status} disabled={!dirty && status === "idle"} />
      </div>

      <Dialog open={resetTarget !== null} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset this template?</DialogTitle>
            <DialogDescription>
              Reset this template to the default? Your changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setResetTarget(null)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-[#2a2a2a] dark:bg-transparent dark:text-zinc-100 dark:hover:bg-[#1f1f1f]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => resetTarget && applyReset(resetTarget.field, resetTarget.step)}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Reset
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
