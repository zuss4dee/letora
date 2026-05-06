import { cache } from "react";

import { getPendingApprovalsQueueSidebarCounts } from "@/lib/actions/agent-approvals";
import { getMaintenanceSafetySidebarAttention } from "@/lib/actions/safety-alerts";
import { getDashboardShellUserSettingsSlice } from "@/lib/dashboard/dashboard-shell-user-settings";

/**
 * Request-scoped memoization for dashboard shell loaders that otherwise re-hit Supabase
 * on overlapping Suspense flushes during the same RSC navigation.
 */

export const getDashboardShellUserSettingsSliceCached = cache(getDashboardShellUserSettingsSlice);

export const getMaintenanceSafetySidebarAttentionCached = cache(getMaintenanceSafetySidebarAttention);

export const getPendingApprovalsQueueSidebarCountsCached = cache(getPendingApprovalsQueueSidebarCounts);
