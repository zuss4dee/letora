import { Suspense } from "react";

import { CommandCenterActionBar, CommandCenterKpis } from "@/components/dashboard/command-center/command-center-kpis";
import { CommandCenterActivity } from "@/components/dashboard/command-center/command-center-activity";
import { CommandCenterActivitySkeleton } from "@/components/dashboard/command-center/command-center-activity";
import { CommandCenterAiComposer } from "@/components/dashboard/command-center/command-center-ai-composer";
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

/**
 * Command Center landing — refactored for everyday operations.
 */
export async function CommandCenterLandingView({ userId }: { userId: string }) {
  const kpis = await loadCommandCenterKpis(userId);
  const isNewUser = kpis.totalProperties === 0;

  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col px-4 pb-36 pt-4 font-['Inter',system-ui,sans-serif] text-[#e5e2e1] md:px-6 md:pb-40 md:pt-6">
        <CommandCenterActionBar />

        {isNewUser ? (
          <CommandCenterOnboardingHero />
        ) : (
          <CommandCenterKpis userId={userId} preloadKpis={kpis} />
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
      </main>
      <CommandCenterAiComposer />
    </>
  );
}
