"use client";

import { Bot } from "lucide-react";

import { useAgentRunners } from "@/components/agents/agent-runners-provider";
import { cn } from "@/lib/utils";

export function SidebarAgentActivityButton({
  className,
  onBeforeOpen,
}: {
  className?: string;
  /** e.g. close mobile sidebar so the panel isn’t obscured behind the sheet */
  onBeforeOpen?: () => void;
}) {
  const { openAgentRuns } = useAgentRunners();

  return (
    <button
      type="button"
      onClick={() => {
        onBeforeOpen?.();
        openAgentRuns();
      }}
      className={cn(
        "relative mx-2 mb-0.5 flex w-[calc(100%-1rem)] touch-manipulation items-center gap-3 rounded-md px-3 py-2.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] font-medium leading-snug tracking-[0.01em] text-zinc-600 transition-[background-color,color] duration-150 ease-out hover:bg-black/[0.035] hover:text-zinc-900 active:bg-black/[0.06] dark:text-zinc-400 dark:hover:bg-white/[0.045] dark:hover:text-zinc-100 dark:active:bg-white/[0.07]",
        className,
      )}
    >
      <Bot className="size-[18px] shrink-0 stroke-[1.5] text-zinc-500 dark:text-zinc-500" aria-hidden />
      Agent activity
    </button>
  );
}
