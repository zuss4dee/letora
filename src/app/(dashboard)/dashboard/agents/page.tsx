export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

const LEGACY_URL = "/dashboard/settings?agentRuns=1";

/**
 * Legacy route: AI agent controls and history now live on the home dashboard,
 * command palette (⌘K), and the Agent activity side panel.
 */
export default function AgentsPageRedirect() {
  redirect(LEGACY_URL);
}
