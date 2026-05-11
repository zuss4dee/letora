"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { saveAIChaseSettings } from "@/app/(dashboard)/dashboard/settings/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  aiChaseSettingsSchema,
  type AiChaseSettingsInput,
  type ChaseTone,
} from "@/lib/validations/user-settings";
import { cn } from "@/lib/utils";

type Props = {
  initialValues: AiChaseSettingsInput;
  onDirtyChange?: (dirty: boolean) => void;
};

const FIELD_LABEL = "text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const FIELD_HELP = "text-xs text-zinc-500 dark:text-zinc-500";

const toneOptions: Array<{ value: ChaseTone; label: string }> = [
  { value: "friendly", label: "Friendly" },
  { value: "firm", label: "Firm" },
  { value: "formal", label: "Formal" },
  { value: "legal", label: "Legal" },
];

const stepDescriptions: Record<1 | 2 | 3, string> = {
  1: "Light reminder a few days after the rent due date.",
  2: "More direct follow-up if the first nudge is ignored.",
  3: "Final notice — usually formal, before escalation.",
};

function ToneCard({
  step,
  value,
  onChange,
}: {
  step: 1 | 2 | 3;
  value: ChaseTone;
  onChange: (tone: ChaseTone) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 dark:border-[#2a2a2a] dark:bg-[#0e0e0e]">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">
          {step}
        </span>
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Chase {step}
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {stepDescriptions[step]}
      </p>
      <div className="mt-3">
        <Select value={value} onValueChange={(v) => onChange(v as ChaseTone)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select tone" />
          </SelectTrigger>
          <SelectContent>
            {toneOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
  recommended,
  locked,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  recommended?: boolean;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50/40 px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#0e0e0e]">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {title}
          </Label>
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-[#1f1f1f] dark:text-zinc-300">
              <Lock className="size-3" aria-hidden /> Locked default
            </span>
          ) : null}
          {recommended ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <ShieldCheck className="size-3" aria-hidden /> Recommended
            </span>
          ) : null}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
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
    </div>
  );
}

function NumberField({
  id,
  label,
  help,
  suffix,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  suffix?: string;
  min: number;
  max: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="max-w-[7rem]"
        />
        {suffix ? <span className="text-sm text-zinc-500 dark:text-zinc-400">{suffix}</span> : null}
      </div>
      {help ? <p className={FIELD_HELP}>{help}</p> : null}
    </div>
  );
}

export function AiChaseSettings({ initialValues, onDirtyChange }: Props) {
  const form = useForm<AiChaseSettingsInput>({
    resolver: zodResolver(aiChaseSettingsSchema) as Resolver<AiChaseSettingsInput>,
    defaultValues: initialValues,
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmTurnOffApproval, setConfirmTurnOffApproval] = useState(false);

  const dirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function onSubmit(values: AiChaseSettingsInput) {
    setSaveError(null);
    setStatus("loading");
    const result = await saveAIChaseSettings(values);
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

  function handleApprovalToggle(next: boolean) {
    if (!next) {
      setConfirmTurnOffApproval(true);
      return;
    }
    form.setValue("chaseRequireApproval", true, { shouldDirty: true });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">AI &amp; Chasing</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Control how Letora&apos;s rent-chasing agent runs — when it acts, how often it sends, and the
          tone it uses across each step of the chase sequence.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <NumberField
              id="chase-trigger-days"
              label="Trigger after"
              suffix="days overdue"
              help="How many days past the rent due date before the first chase is queued."
              min={1}
              max={30}
              value={form.watch("chaseTriggerDays")}
              onChange={(n) =>
                form.setValue("chaseTriggerDays", n, { shouldDirty: true, shouldValidate: true })
              }
            />
            <NumberField
              id="chase-max-per-month"
              label="Maximum chases"
              suffix="per tenant / month"
              help="Hard cap to avoid harassment complaints under UK rules."
              min={1}
              max={10}
              value={form.watch("chaseMaxPerMonth")}
              onChange={(n) =>
                form.setValue("chaseMaxPerMonth", n, { shouldDirty: true, shouldValidate: true })
              }
            />
            <NumberField
              id="chase-min-gap"
              label="Minimum gap"
              suffix="days between sends"
              help="Letora won&apos;t send another chase to the same tenant inside this window."
              min={1}
              max={30}
              value={form.watch("chaseMinGapDays")}
              onChange={(n) =>
                form.setValue("chaseMinGapDays", n, { shouldDirty: true, shouldValidate: true })
              }
            />
          </div>

          <ToggleRow
            id="chase-allow-weekends"
            title="Allow weekend sends"
            description="By default Letora pauses chases on Saturday and Sunday."
            checked={form.watch("chaseAllowWeekends")}
            onChange={(next) =>
              form.setValue("chaseAllowWeekends", next, { shouldDirty: true })
            }
          />

          <NumberField
            id="chase-escalation"
            label="Escalate after"
            suffix="failed chases"
            help="Number of unanswered chases before the case is flagged for escalation."
            min={1}
            max={6}
            value={form.watch("chaseEscalationThreshold")}
            onChange={(n) =>
              form.setValue("chaseEscalationThreshold", n, { shouldDirty: true, shouldValidate: true })
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Chase tone sequence</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Set the tone for each step of the chase. Letora will rewrite the templates to match.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <ToneCard
            step={1}
            value={form.watch("chaseTone1")}
            onChange={(v) => form.setValue("chaseTone1", v, { shouldDirty: true })}
          />
          <ToneCard
            step={2}
            value={form.watch("chaseTone2")}
            onChange={(v) => form.setValue("chaseTone2", v, { shouldDirty: true })}
          />
          <ToneCard
            step={3}
            value={form.watch("chaseTone3")}
            onChange={(v) => form.setValue("chaseTone3", v, { shouldDirty: true })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none">
        <div className="space-y-4">
          <ToggleRow
            id="chase-require-approval"
            title="Require approval before sending"
            description="Letora drafts every chase email and waits for you to approve in the queue."
            checked={form.watch("chaseRequireApproval")}
            onChange={handleApprovalToggle}
            recommended
          />
          <ToggleRow
            id="chase-ai-proactive"
            title="Let Letora work proactively"
            description="Allow the AI to plan chase schedules and surface issues without being asked."
            checked={form.watch("chaseAiProactive")}
            onChange={(next) => form.setValue("chaseAiProactive", next, { shouldDirty: true })}
          />
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

      <Dialog
        open={confirmTurnOffApproval}
        onOpenChange={(open) => setConfirmTurnOffApproval(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send chase emails without approval?</DialogTitle>
            <DialogDescription>
              Letora will dispatch chase emails the moment they&apos;re ready. We strongly recommend
              keeping approval on while you build trust with the agent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmTurnOffApproval(false)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-[#2a2a2a] dark:bg-transparent dark:text-zinc-100 dark:hover:bg-[#1f1f1f]"
            >
              Keep approval on
            </button>
            <button
              type="button"
              onClick={() => {
                form.setValue("chaseRequireApproval", false, { shouldDirty: true });
                setConfirmTurnOffApproval(false);
              }}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
            >
              Turn approval off
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
