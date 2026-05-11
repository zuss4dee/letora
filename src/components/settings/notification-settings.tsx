"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { saveNotificationSettings } from "@/app/(dashboard)/dashboard/settings/actions";
import { SettingsSaveButton, type SaveStatus } from "@/components/settings/settings-save-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type DigestDay,
  notificationSettingsSchema,
  type NotificationSettingsInput,
} from "@/lib/validations/user-settings";
import { cn } from "@/lib/utils";

type Props = {
  initialValues: NotificationSettingsInput;
  onDirtyChange?: (dirty: boolean) => void;
};

const FIELD_LABEL = "text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const FIELD_HELP = "text-xs text-zinc-500 dark:text-zinc-500";

const DAY_OPTIONS: Array<{ value: DigestDay; label: string }> = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
];

const TIME_OPTIONS: ReadonlyArray<string> = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "12:00",
  "14:00",
  "17:00",
  "19:00",
  "21:00",
];

function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-zinc-900 dark:bg-white" : "bg-zinc-200 dark:bg-zinc-700",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 transform rounded-full shadow transition-transform",
          checked ? "translate-x-4 bg-white dark:bg-zinc-900" : "translate-x-0.5 bg-white",
        )}
      />
    </button>
  );
}

function NotificationRow({
  id,
  title,
  description,
  checked,
  onChange,
  children,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/40 px-4 py-4 dark:border-[#2a2a2a] dark:bg-[#0e0e0e]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {title}
          </Label>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
        <Toggle id={id} checked={checked} onChange={onChange} label={title} />
      </div>
      {checked && children ? (
        <div className="border-t border-zinc-200 pt-3 dark:border-[#2a2a2a]">{children}</div>
      ) : null}
    </div>
  );
}

export function NotificationSettings({ initialValues, onDirtyChange }: Props) {
  const form = useForm<NotificationSettingsInput>({
    resolver: zodResolver(notificationSettingsSchema) as Resolver<NotificationSettingsInput>,
    defaultValues: initialValues,
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function onSubmit(values: NotificationSettingsInput) {
    setSaveError(null);
    setStatus("loading");
    const result = await saveNotificationSettings(values);
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Notifications</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Choose what to hear about. Letora batches updates into a digest so you&apos;re not flooded.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none">
        <div className="space-y-4">
          <NotificationRow
            id="notif-rent-overdue"
            title="Rent overdue alerts"
            description="Notify me when a tenant&apos;s rent is overdue."
            checked={form.watch("notifRentOverdue")}
            onChange={(next) => form.setValue("notifRentOverdue", next, { shouldDirty: true })}
          >
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <Label htmlFor="notif-rent-overdue-days" className={FIELD_LABEL}>
                Notify me after
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="notif-rent-overdue-days"
                  type="number"
                  min={1}
                  max={14}
                  onFocus={(e) => e.target.select()}
                  className="max-w-[6rem]"
                  value={form.watch("notifRentOverdueDays")}
                  onChange={(e) =>
                    form.setValue("notifRentOverdueDays", Number(e.target.value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">days overdue</span>
              </div>
            </div>
          </NotificationRow>

          <NotificationRow
            id="notif-escalation"
            title="Escalation alerts"
            description="Tell me when a chase sequence has been escalated to legal/Section 8 review."
            checked={form.watch("notifEscalation")}
            onChange={(next) => form.setValue("notifEscalation", next, { shouldDirty: true })}
          />

          <NotificationRow
            id="notif-approval-ready"
            title="Approval queue updates"
            description="Ping me when there are new agent actions awaiting my approval."
            checked={form.watch("notifApprovalReady")}
            onChange={(next) => form.setValue("notifApprovalReady", next, { shouldDirty: true })}
          >
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <Label htmlFor="notif-approval-queue-threshold" className={FIELD_LABEL}>
                Alert me at
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="notif-approval-queue-threshold"
                  type="number"
                  min={1}
                  max={50}
                  onFocus={(e) => e.target.select()}
                  className="max-w-[6rem]"
                  value={form.watch("notifApprovalQueueThreshold")}
                  onChange={(e) =>
                    form.setValue("notifApprovalQueueThreshold", Number(e.target.value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">items in queue</span>
              </div>
            </div>
          </NotificationRow>

          <NotificationRow
            id="notif-maintenance"
            title="Maintenance updates"
            description="New maintenance tickets, agent triage, and contractor follow-ups."
            checked={form.watch("notifMaintenance")}
            onChange={(next) => form.setValue("notifMaintenance", next, { shouldDirty: true })}
          />

          <NotificationRow
            id="notif-weekly-digest"
            title="Weekly digest"
            description="A single email with rent collected, arrears, leads, and what Letora did this week."
            checked={form.watch("notifWeeklyDigest")}
            onChange={(next) => form.setValue("notifWeeklyDigest", next, { shouldDirty: true })}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="notif-digest-day" className={FIELD_LABEL}>
                  Send on
                </Label>
                <Select
                  value={form.watch("notifDigestDay")}
                  onValueChange={(v) =>
                    form.setValue("notifDigestDay", v as DigestDay, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="notif-digest-day" className="w-full">
                    <SelectValue placeholder="Select a day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notif-digest-time" className={FIELD_LABEL}>
                  At
                </Label>
                <Select
                  value={form.watch("notifDigestTime")}
                  onValueChange={(v) => form.setValue("notifDigestTime", v, { shouldDirty: true })}
                >
                  <SelectTrigger id="notif-digest-time" className="w-full">
                    <SelectValue placeholder="Select a time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className={cn(FIELD_HELP, "sm:col-span-2")}>Times are local UK time.</p>
            </div>
          </NotificationRow>
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
  );
}
