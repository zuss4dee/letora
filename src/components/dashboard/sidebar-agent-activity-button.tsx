"use client";

import { Bot } from "lucide-react";

import { useAgentRunners } from "@/components/agents/agent-runners-provider";
import { cn } from "@/lib/utils";

export function SidebarAgentActivityButton({ className }: { className?: string }) {
  const { openAgentRuns } = useAgentRunners();

  return (
    <button
      type="button"
      onClick={() => openAgentRuns()}
      className={cn(
        "mb-2 flex w-full items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] text-[#ACABAA] transition-colors hover:bg-[#1F2020] hover:text-[#C9C6C5]",
        className,
      )}
    >
      <Bot className="size-5 shrink-0 stroke-[1.25]" aria-hidden />
      Agent activity
    </button>
  );
}
