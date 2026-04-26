import { SidebarPatch } from "@/components/dashboard/sidebar-dynamic-context";
import { getPendingAgentApprovals } from "@/lib/actions/agent-approvals";
import { computeApprovalQueueStats } from "@/lib/approvals/queue-stats";
import { withTimeout } from "@/lib/async/with-timeout";

export async function SidebarApprovalsMeta() {
  const pendingApprovals = await withTimeout(
    getPendingAgentApprovals(),
    3000,
    [],
    "sidebar:approvals:getPendingAgentApprovals",
  );
  const pendingApprovalQueueStats = computeApprovalQueueStats(pendingApprovals);
  const pendingApprovalsBadgeTitle =
    pendingApprovalQueueStats.stalePendingCount > 0
      ? `${pendingApprovalQueueStats.stalePendingCount} pending over 48 hours - review when you can`
      : null;

  return (
    <SidebarPatch
      pendingApprovalsCount={pendingApprovals.length}
      pendingApprovalsBadgeTitle={pendingApprovalsBadgeTitle}
    />
  );
}
