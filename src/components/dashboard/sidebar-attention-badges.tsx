import { SidebarPatch } from "@/components/dashboard/sidebar-dynamic-context";
import { getComplianceExpiredSidebarAttention } from "@/lib/actions/compliance";
import { getMaintenanceSafetySidebarAttention } from "@/lib/actions/safety-alerts";
import { withTimeout } from "@/lib/async/with-timeout";

export async function SidebarAttentionBadges({ userId }: { userId: string }) {
  const [complianceAttention, maintenanceAttention] = await Promise.all([
    withTimeout(getComplianceExpiredSidebarAttention(userId), 3000, false, "sidebar:complianceAttention"),
    withTimeout(getMaintenanceSafetySidebarAttention(userId), 3000, false, "sidebar:maintenanceAttention"),
  ]);

  return (
    <SidebarPatch complianceAttention={complianceAttention} maintenanceAttention={maintenanceAttention} />
  );
}
