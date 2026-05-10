"use client";

import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const showAction = Boolean(actionLabel?.trim() && onAction);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center sm:py-20",
        className,
      )}
    >
      <div className="mb-4 rounded-full bg-zinc-100 p-4 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500">
        <Icon className="h-8 w-8" aria-hidden />
      </div>
      <h3 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mb-6 max-w-[280px] text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      {showAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 sm:w-auto dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
