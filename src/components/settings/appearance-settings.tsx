"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { saveAppearanceSection } from "@/app/(dashboard)/dashboard/settings/actions";
import { SettingsSaveButton, type SaveStatus } from "@/components/settings/settings-save-button";
import { useTheme } from "@/components/theme-provider-client";
import { cn } from "@/lib/utils";
import { type ThemePreference } from "@/lib/validations/user-settings";

type Props = {
  initialValue: ThemePreference;
  onDirtyChange?: (dirty: boolean) => void;
};

const OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "light",
    title: "Light",
    description: "Bright surfaces. Best for daytime work.",
    icon: Sun,
  },
  {
    value: "dark",
    title: "Dark",
    description: "Letora's editorial Nocturnal Architect dark theme.",
    icon: Moon,
  },
  {
    value: "system",
    title: "System",
    description: "Match the appearance of your operating system.",
    icon: Monitor,
  },
];

export function AppearanceSettings({ initialValue, onDirtyChange }: Props) {
  const { setTheme } = useTheme();
  const [pending, setPending] = useState<ThemePreference>(initialValue);
  const [saved, setSaved] = useState<ThemePreference>(initialValue);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const dirty = pending !== saved;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function handleSelect(next: ThemePreference) {
    setPending(next);
    setTheme(next);
  }

  async function handleSave() {
    setStatus("loading");
    const result = await saveAppearanceSection({ themePreference: pending });
    if (!result.ok) {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2000);
      return;
    }
    setSaved(pending);
    setStatus("success");
    window.setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Appearance</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pick the theme you want Letora to use across this device. Your choice is saved to your
          account so it follows you everywhere.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#161616] dark:shadow-none">
        <div className="grid gap-4 md:grid-cols-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = pending === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                aria-pressed={active}
                className={cn(
                  "group relative flex h-full flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all",
                  active
                    ? "border-zinc-900 ring-2 ring-zinc-900/10 dark:border-white dark:ring-white/15"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-[#2a2a2a] dark:hover:border-zinc-600",
                )}
              >
                <div
                  className={cn(
                    "flex h-24 w-full items-center justify-center rounded-lg",
                    option.value === "light"
                      ? "bg-zinc-50 text-zinc-900"
                      : option.value === "dark"
                        ? "bg-[#141312] text-zinc-100"
                        : "bg-gradient-to-r from-zinc-50 to-[#141312] text-zinc-700 dark:text-zinc-200",
                  )}
                >
                  <Icon className="size-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {option.title}
                    </span>
                    {active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        <Check className="size-3" /> Active
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-stretch justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-[#2a2a2a] sm:flex-row sm:items-center">
        <SettingsSaveButton status={status} disabled={!dirty && status === "idle"} />
      </div>
    </form>
  );
}
