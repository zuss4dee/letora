"use client";

import { FileText, Loader2, Mail, Users } from "lucide-react";
import type { ReactNode } from "react";

import { useAgentRunners } from "@/components/agents/agent-runners-provider";
import { cn } from "@/lib/utils";

type ChipProps = {
  icon: ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  busy?: boolean;
};

function QuickChip({ icon, label, description, onClick, busy }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "group flex min-w-[10rem] flex-1 flex-col items-start gap-1 rounded-lg border border-[#484848]/30 bg-[#131313]/80 px-4 py-3 text-left transition-colors",
        "hover:border-[#BD9952]/40 hover:bg-[#BD9952]/5",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <span className="flex items-center gap-2 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#BD9952]">
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : icon}
        {label}
      </span>
      <span className="font-[family-name:var(--font-inter)] text-xs leading-snug text-[#ACABAA]">
        {description}
      </span>
    </button>
  );
}

export function AgentQuickActions() {
  const {
    runRentChaser,
    runLeadQualifier,
    openContractDrafter,
    openAgentRuns,
    isRentRunning,
    isLeadRunning,
    isContractRunning,
  } = useAgentRunners();

  return (
    <div className="mt-10 w-full max-w-4xl">
      <p className="mb-4 font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-[0.14em] text-[#ACABAA]">
        Quick actions
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <QuickChip
          icon={<Mail className="size-3.5" aria-hidden />}
          label="Rent Chaser"
          description="Draft overdue rent chase emails"
          onClick={() => void runRentChaser()}
          busy={isRentRunning}
        />
        <QuickChip
          icon={<Users className="size-3.5" aria-hidden />}
          label="Lead Qualifier"
          description="Score new leads in your pipeline"
          onClick={() => void runLeadQualifier()}
          busy={isLeadRunning}
        />
        <QuickChip
          icon={<FileText className="size-3.5" aria-hidden />}
          label="Contract Drafter"
          description="Generate text for a draft contract"
          onClick={openContractDrafter}
          busy={isContractRunning}
        />
      </div>
      <button
        type="button"
        onClick={openAgentRuns}
        className="mt-4 w-full font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-[0.12em] text-[#ACABAA] underline-offset-4 transition-colors hover:text-[#BD9952] hover:underline sm:text-center"
      >
        View agent activity log
      </button>
    </div>
  );
}
