"use client";

import { Bot } from "lucide-react";

import { useAgentRunners } from "@/components/agents/agent-runners-provider";

export function SettingsAgentActivityCard() {
  const { openAgentRuns } = useAgentRunners();

  return (
    <div className="rounded-sm border border-[#484848]/20 bg-[#131313]/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-[#1F2020] text-[#BD9952]">
            <Bot className="size-4 stroke-[1.25]" aria-hidden />
          </div>
          <div>
            <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Agent activity
            </p>
            <p className="mt-0.5 font-[family-name:var(--font-inter)] text-sm text-foreground">
              View recent runs from Rent Chaser, Lead Qualifier, and Contract Drafter.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openAgentRuns()}
          className="shrink-0 self-start border border-[#484848]/30 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#BD9952] transition-colors hover:border-[#BD9952]/50 hover:bg-[#BD9952]/5 sm:self-center"
        >
          Open log
        </button>
      </div>
    </div>
  );
}
