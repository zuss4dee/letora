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
        "mb-2 flex w-full items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted/90 hover:text-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground",
        className,
      )}
    >
      <Bot className="size-5 shrink-0 stroke-[1.25]" aria-hidden />
      Agent activity
    </button>
  );
}
