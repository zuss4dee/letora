import { SidebarPatch } from "@/components/dashboard/sidebar-dynamic-context";
import { withTimeout } from "@/lib/async/with-timeout";
import {
  getMaintenanceSafetySidebarAttentionCached,
  getPendingApprovalsQueueSidebarCountsCached,
} from "@/lib/dashboard/cached-shell-reads";

const DASHBOARD_SHELL_FETCH_MS = 6000;

/**
 * Sidebar maintenance dot + approvals badge populated in one Suspense flush with parallel IO.
 */
export async function SidebarWorkflowMeta({ userId }: { userId: string }) {
  const [maintenanceAttention, approvalCounts] = await Promise.all([
    withTimeout(
      getMaintenanceSafetySidebarAttentionCached(userId),
      DASHBOARD_SHELL_FETCH_MS,
      false,
      "sidebar:maintenanceAttention",
    ),
    withTimeout(
      getPendingApprovalsQueueSidebarCountsCached(userId),
      DASHBOARD_SHELL_FETCH_MS,
      { pendingTotal: 0, stalePendingCount: 0 },
      "sidebar:approvals:getPendingAgentApprovals",
    ),
  ]);

  const pendingApprovalsBadgeTitle =
    approvalCounts.stalePendingCount > 0
      ? `${approvalCounts.stalePendingCount} pending over 48 hours - review when you can`
      : null;

  return (
    <SidebarPatch
      maintenanceAttention={maintenanceAttention}
      pendingApprovalsCount={approvalCounts.pendingTotal}
      pendingApprovalsBadgeTitle={pendingApprovalsBadgeTitle}
    />
  );
}
