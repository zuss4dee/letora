import { SidebarPatch } from "@/components/dashboard/sidebar-dynamic-context";
import { getPendingApprovalsQueueMetrics } from "@/lib/actions/agent-approvals";
import { getMaintenanceSafetySidebarAttention } from "@/lib/actions/safety-alerts";
import { computeApprovalQueueStats } from "@/lib/approvals/queue-stats";
import { withTimeout } from "@/lib/async/with-timeout";

/**
 * Sidebar maintenance dot + approvals badge populated in one Suspense flush with parallel IO.
 */
export async function SidebarWorkflowMeta({ userId }: { userId: string }) {
  const [maintenanceAttention, pendingMetricRows] = await Promise.all([
    withTimeout(
      getMaintenanceSafetySidebarAttention(userId),
      4500,
      false,
      "sidebar:maintenanceAttention",
    ),
    withTimeout(getPendingApprovalsQueueMetrics(userId), 4500, [], "sidebar:approvals:getPendingAgentApprovals"),
  ]);

  const pendingApprovalQueueStats = computeApprovalQueueStats(pendingMetricRows);
  const pendingApprovalsBadgeTitle =
    pendingApprovalQueueStats.stalePendingCount > 0
      ? `${pendingApprovalQueueStats.stalePendingCount} pending over 48 hours - review when you can`
      : null;

  return (
    <SidebarPatch
      maintenanceAttention={maintenanceAttention}
      pendingApprovalsCount={pendingApprovalQueueStats.pendingTotal}
      pendingApprovalsBadgeTitle={pendingApprovalsBadgeTitle}
    />
  );
}
