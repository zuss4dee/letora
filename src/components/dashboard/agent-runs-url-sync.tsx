"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useAgentRunners } from "@/components/agents/agent-runners-provider";

/**
 * Opens the agent activity sheet when `?agentRuns=1` is present (e.g. legacy links),
 * then strips the query while staying on the current route.
 */
export function AgentRunsUrlSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openAgentRuns } = useAgentRunners();
  const processed = useRef(false);
  const flag = searchParams.get("agentRuns");

  useEffect(() => {
    if (flag !== "1") {
      processed.current = false;
      return;
    }
    if (processed.current) return;
    processed.current = true;
    openAgentRuns();
    const base = pathname || "/dashboard";
    router.replace(base, { scroll: false });
  }, [flag, openAgentRuns, router, pathname]);

  return null;
}
