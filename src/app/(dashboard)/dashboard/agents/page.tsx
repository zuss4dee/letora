export const dynamic = "force-dynamic";

import { AgentRunsTable } from "@/components/agents/agent-runs-table";
import { AgentsClient } from "@/components/agents/agents-client";
import { getAgentRuns } from "@/lib/actions/agents";

export default async function AgentsPage() {
  const runs = await getAgentRuns();

  return (
    <>
      <AgentsClient />
      <AgentRunsTable initialRuns={runs} />
    </>
  );
}
