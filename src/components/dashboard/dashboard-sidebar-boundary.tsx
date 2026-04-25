import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { getPendingAgentApprovals } from "@/lib/actions/agent-approvals";
import { getComplianceExpiredSidebarAttention } from "@/lib/actions/compliance";
import { getMaintenanceSafetySidebarAttention } from "@/lib/actions/safety-alerts";
import { getUserSettings } from "@/lib/actions/user-settings";
import { computeApprovalQueueStats } from "@/lib/approvals/queue-stats";
import { withTimeout } from "@/lib/async/with-timeout";

type DashboardSidebarBoundaryProps = {
  userId: string;
  userEmail: string | null;
};

export async function DashboardSidebarBoundary({ userId, userEmail }: DashboardSidebarBoundaryProps) {
  const pendingApprovals = await withTimeout(
    getPendingAgentApprovals(),
    3000,
    [],
    "sidebar:getPendingAgentApprovals",
  );
  const settings = await withTimeout(getUserSettings(userId), 3000, null, "sidebar:getUserSettings");
  const complianceAttention = await withTimeout(
    getComplianceExpiredSidebarAttention(userId),
    3000,
    false,
    "sidebar:getComplianceExpiredSidebarAttention",
  );
  const maintenanceAttention = await withTimeout(
    getMaintenanceSafetySidebarAttention(userId),
    3000,
    false,
    "sidebar:getMaintenanceSafetySidebarAttention",
  );

  const pendingApprovalQueueStats = computeApprovalQueueStats(pendingApprovals);
  const pendingApprovalsBadgeTitle =
    pendingApprovalQueueStats.stalePendingCount > 0
      ? `${pendingApprovalQueueStats.stalePendingCount} pending over 48 hours - review when you can`
      : null;

  return (
    <AppSidebar
      variant="sidebar"
      userEmail={userEmail}
      complianceAttention={complianceAttention}
      maintenanceAttention={maintenanceAttention}
      subscriptionPlan={settings?.subscriptionPlan ?? null}
      subscriptionStatus={settings?.subscriptionStatus ?? null}
      subscriptionPeriodEnd={settings?.subscriptionPeriodEnd ?? null}
      subscriptionTrialEnd={settings?.subscriptionTrialEnd ?? null}
      pendingApprovalsCount={pendingApprovals.length}
      pendingApprovalsBadgeTitle={pendingApprovalsBadgeTitle}
    />
  );
}
