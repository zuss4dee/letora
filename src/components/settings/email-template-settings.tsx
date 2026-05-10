"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { saveEmailTemplatesSection } from "@/app/(dashboard)/dashboard/settings/actions";
import { SettingsSaveButton, type SaveStatus } from "@/components/settings/settings-save-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  { token: "{{tenant_name}}", description: "Full name of the tenant" },
  { token: "{{property_address}}", description: "Address of the let property" },
  { token: "{{amount_due}}", description: "Amount currently outstanding" },
  { token: "{{due_date}}", description: "Original rent due date" },
  { token: "{{days_overdue}}", description: "Days past the due date" },
  { token: "{{landlord_name}}", description: "Your name (from Profile)" },
  { token: "{{org_name}}", description: "Your organisation name" },
];

const DEFAULT_TEMPLATES: Record<
  1 | 2 | 3,
  { subject: string; body: string }
> = {
  1: {
    subject: "Friendly reminder: rent for {{property_address}}",
    body: `Hi {{tenant_name}},\n\nThis is a quick reminder that your rent of {{amount_due}} for {{property_address}} was due on {{due_date}} and we haven't seen it land yet.\n\nIf you've paid in the last 24 hours, please ignore this. Otherwise, please send the payment when you can or let me know if you need to chat through it.\n\nThanks,\n{{landlord_name}}`,
  },
  2: {
    subject: "Action needed: rent overdue at {{property_address}}",
    body: `Hi {{tenant_name}},\n\nWe still haven't received the {{amount_due}} due on {{due_date}} for {{property_address}} — it's now {{days_overdue}} days overdue.\n\nPlease either pay today or reply to confirm a date you'll have it cleared.\n\n{{landlord_name}}\n{{org_name}}`,
  },
  3: {
    subject: "Final notice: rent overdue at {{property_address}}",
    body: `Dear {{tenant_name}},\n\nThis is a formal final notice that the rent of {{amount_due}} due on {{due_date}} for {{property_address}} remains unpaid ({{days_overdue}} days overdue).\n\nIf payment or a written repayment plan isn't received within 7 days, we will escalate this matter as set out in your tenancy agreement.\n\nRegards,\n{{landlord_name}}\n{{org_name}}`,
  },
};

type ChaseField = "emailChase1" | "emailChase2" | "emailChase3";

const CHASE_STEPS: Array<{ step: 1 | 2 | 3; field: ChaseField; label: string }> = [
  { step: 1, field: "emailChase1", label: "Chase 1 — initial reminder" },
  { step: 2, field: "emailChase2", label: "Chase 2 — follow up" },
  { step: 3, field: "emailChase3", label: "Chase 3 — final notice" },
];

export function EmailTemplateSettings({ initialValues, onDirtyChange }: Props) {
  const form = useForm<EmailTemplatesSettingsInput>({
    resolver: zodResolver(emailTemplatesSettingsSchema),
    defaultValues: initialValues,
  });
  const [status, setStatus] = useState<SaveStatus>("idle");

  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function onSubmit(values: EmailTemplatesSettingsInput) {
    setStatus("loading");
    const result = await saveEmailTemplatesSection(values);
    if (!result.ok) {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2000);
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

  function resetTemplate(field: ChaseField, step: 1 | 2 | 3) {
    const subjectKey = `${field}Subject` as keyof EmailTemplatesSettingsInput;
    const bodyKey = `${field}Body` as keyof EmailTemplatesSettingsInput;
    form.setValue(subjectKey, DEFAULT_TEMPLATES[step].subject, { shouldDirty: true });
    form.setValue(bodyKey, DEFAULT_TEMPLATES[step].body, { shouldDirty: true });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Email templates</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Customise how chase emails read. Letora rewrites the tone according to the rules you set in
          AI &amp; Chasing — these subjects and bodies are the starting point.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Sender details</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Shown in the From and Reply-To headers of every email Letora sends.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email-sender-name" className={FIELD_LABEL}>
              Sender name
            </Label>
            <Input
              id="email-sender-name"
              placeholder="e.g. Smith Lettings"
              {...form.register("emailSenderName")}
            />
            <p className={FIELD_HELP}>Display name. The address comes from the Letora platform.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-reply-to" className={FIELD_LABEL}>
              Reply-to address
            </Label>
            <Input
              id="email-reply-to"
              type="email"
              placeholder="rent@yourcompany.co.uk"
              {...form.register("emailReplyTo")}
            />
            <p className={FIELD_HELP}>Where tenants&apos; replies should land.</p>
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
                  Tone {step}/3 in the chase sequence. Use variables to personalise.
                </p>
              </div>
              <button
                type="button"
                onClick={() => resetTemplate(field, step)}
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
                  Subject
                </Label>
                <Input
                  id={`${field}-subject`}
                  placeholder={DEFAULT_TEMPLATES[step].subject}
                  {...form.register(subjectKey)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor={`${field}-body`} className={FIELD_LABEL}>
                    Body
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map((variable) => (
                      <button
                        key={variable.token}
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
                  placeholder={DEFAULT_TEMPLATES[step].body}
                  {...form.register(bodyKey)}
                  className="font-mono text-sm leading-relaxed"
                />
                <p className={FIELD_HELP}>
                  Click a variable above to insert it at your cursor. The AI will replace these at send time.
                </p>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex flex-col items-stretch justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-[#2a2a2a] sm:flex-row sm:items-center">
        <SettingsSaveButton status={status} disabled={!dirty && status === "idle"} />
      </div>
    </form>
  );
}
