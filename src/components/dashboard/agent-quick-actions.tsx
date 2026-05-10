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
        "group flex min-w-[10rem] flex-1 flex-col items-start gap-1.5 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-all duration-200 ease-out",
        "hover:border-secondary/35 hover:bg-muted/80 dark:hover:bg-background dark:bg-[#141210]",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <span className="flex items-center gap-2 font-headline text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#BD9952]">
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : icon}
        {label}
      </span>
      <span className="font-headline text-[0.75rem] font-normal leading-snug text-muted-foreground">
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
    <div className="mt-12 w-full">
      <p className="mb-3 font-headline text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        Quick actions
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        <QuickChip
          icon={<Mail className="size-3.5" aria-hidden />}
          label="Rent Chaser"
          description="Draft chases — sends only after your approval"
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
        className="mt-5 w-full font-headline text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground underline-offset-4 transition-colors hover:text-secondary hover:underline"
      >
        Agent activity log
      </button>
    </div>
  );
}
