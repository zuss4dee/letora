"use client";

import { Suspense, type ReactNode } from "react";

import { AgentRunnersProvider } from "@/components/agents/agent-runners-provider";
import { AgentRunsUrlSync } from "@/components/dashboard/agent-runs-url-sync";
import { CommandPaletteProvider } from "@/components/dashboard/dashboard-command-palette";
import type { AgentRun } from "@/lib/actions/agents";

export function DashboardShellProviders({
  children,
  initialAgentRuns,
}: {
  children: ReactNode;
  initialAgentRuns: AgentRun[];
}) {
  return (
    <AgentRunnersProvider initialRuns={initialAgentRuns}>
      <CommandPaletteProvider>
        <Suspense fallback={null}>
          <AgentRunsUrlSync />
        </Suspense>
        {children}
      </CommandPaletteProvider>
    </AgentRunnersProvider>
  );
}
