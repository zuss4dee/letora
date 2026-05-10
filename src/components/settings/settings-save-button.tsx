"use client";

import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "loading" | "success" | "error";

type Props = {
  status: SaveStatus;
  disabled?: boolean;
  /** Custom label shown in idle state. Defaults to "Save changes". */
  idleLabel?: string;
  /** Optional onClick — defaults to submitting the parent <form>. */
  onClick?: () => void;
  /** Form-submit by default. */
  type?: "submit" | "button";
};

const baseClasses =
  "inline-flex h-9 min-w-[120px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/45 disabled:cursor-not-allowed dark:focus-visible:ring-zinc-500/40";

const idleClasses =
  "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 disabled:opacity-50";

const successClasses =
  "bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:text-emerald-50";

const errorClasses =
  "bg-red-600 text-white hover:bg-red-600 dark:bg-red-500 dark:text-red-50";

export function SettingsSaveButton({
  status,
  disabled,
  idleLabel = "Save changes",
  onClick,
  type = "submit",
}: Props) {
  const isBusy = status === "loading";
  const isSuccess = status === "success";
  const isError = status === "error";

  const variantClass = isSuccess
    ? successClasses
    : isError
      ? errorClasses
      : idleClasses;

  return (
    <button
      type={type}
      disabled={Boolean(disabled) || isBusy}
      onClick={onClick}
      data-state={status}
      className={cn(baseClasses, variantClass, "w-full sm:w-auto")}
    >
      {isBusy ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span>Saving…</span>
        </>
      ) : isSuccess ? (
        <>
          <Check className="size-4" aria-hidden />
          <span>Saved</span>
        </>
      ) : isError ? (
        <span>Failed to save</span>
      ) : (
        <span>{idleLabel}</span>
      )}
    </button>
  );
}
