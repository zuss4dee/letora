import { Suspense } from "react";

import { CommandCenterActionBar, CommandCenterKpisPresentation } from "@/components/dashboard/command-center/command-center-kpis";
import { CommandCenterActivity } from "@/components/dashboard/command-center/command-center-activity";
import { CommandCenterActivitySkeleton } from "@/components/dashboard/command-center/command-center-activity";
import { CommandCenterAiComposer } from "@/components/dashboard/command-center/command-center-ai-composer";
import { CommandCenterFailedImportBanner } from "@/components/dashboard/command-center/command-center-failed-import-banner";
import { CommandCenterOnboardingHero } from "@/components/dashboard/command-center/command-center-onboarding-hero";
import {
  CommandCenterArrearsQueue,
  CommandCenterMaintenanceQueue,
  CommandCenterQueueSkeleton,
} from "@/components/dashboard/command-center/command-center-queues";
import {
  CommandCenterAgentSummary,
  CommandCenterAgentSummarySkeleton,
} from "@/components/dashboard/command-center/command-center-agent-summary";
import { loadCommandCenterKpis } from "@/lib/dashboard/command-center-queries";
import { getBatchImportsForUser } from "@/lib/actions/batch-onboarding";

/**
 * Command Center landing — refactored for everyday operations.
 */
export async function CommandCenterLandingView({ userId }: { userId: string }) {
  const kpiLoad = await loadCommandCenterKpis(userId);
  const batches = await getBatchImportsForUser(userId);
  const failedImportFollowUp =
    batches.find((b) => typeof b.rowsFailed === "number" && b.rowsFailed > 0) ?? null;
  /** Degraded KPIs also yield `totalProperties === 0` — do not show onboarding hero in that case. */
  const isNewUser = !kpiLoad.kpisDegraded && kpiLoad.kpis.totalProperties === 0;

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-[#0B0B0B] font-['Inter',system-ui,sans-serif] text-[#e5e2e1]">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10 pt-4 md:px-6 md:pb-12 md:pt-6">
        <CommandCenterActionBar />

        {failedImportFollowUp ? (
          <CommandCenterFailedImportBanner batchId={failedImportFollowUp.id} failedCount={failedImportFollowUp.rowsFailed} />
        ) : null}

        {isNewUser ? (
          <CommandCenterOnboardingHero />
        ) : (
          <CommandCenterKpisPresentation kpiLoad={kpiLoad} />
        )}

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Main Action Queues (7 Columns) */}
          <section className="space-y-12 lg:col-span-7">
            <Suspense fallback={<CommandCenterQueueSkeleton />}>
              <CommandCenterArrearsQueue userId={userId} />
            </Suspense>
            
            <Suspense fallback={<CommandCenterQueueSkeleton />}>
              <CommandCenterMaintenanceQueue userId={userId} />
            </Suspense>
          </section>

          {/* Sidebar (5 Columns) */}
          <section className="space-y-10 lg:col-span-5">
            <Suspense fallback={<CommandCenterAgentSummarySkeleton />}>
              <CommandCenterAgentSummary userId={userId} />
            </Suspense>

            <Suspense fallback={<CommandCenterActivitySkeleton />}>
              <CommandCenterActivity userId={userId} />
            </Suspense>
          </section>
        </div>
      </div>

      <footer className="relative z-20 shrink-0 shadow-[0_-12px_32px_rgba(0,0,0,0.45)]">
        <CommandCenterAiComposer />
      </footer>
    </main>
  );
}
