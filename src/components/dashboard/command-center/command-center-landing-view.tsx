import { Suspense } from "react";

import {
  CommandCenterActionBar,
  CommandCenterKpiGridSkeleton,
  CommandCenterKpis,
} from "@/components/dashboard/command-center/command-center-kpis";
import {
  CommandCenterAttention,
  CommandCenterAttentionSkeleton,
} from "@/components/dashboard/command-center/command-center-attention";
import {
  CommandCenterActivity,
  CommandCenterActivitySkeleton,
} from "@/components/dashboard/command-center/command-center-activity";
import {
  CommandCenterOnboardingTasks,
  CommandCenterOnboardingTasksSkeleton,
} from "@/components/dashboard/command-center/command-center-onboarding-tasks";
import { CommandCenterAiComposer } from "@/components/dashboard/command-center/command-center-ai-composer";

/**
 * Command Center landing — visual parity with stitch reference.
 * Slow reads are isolated per section (Suspense + timeouts in loaders).
 */
export function CommandCenterLandingView({ userId }: { userId: string }) {
  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col px-4 pb-28 pt-4 font-['Inter',system-ui,sans-serif] text-[#e5e2e1] md:px-6 md:pb-32 md:pt-6">
        <CommandCenterActionBar />

        <Suspense fallback={<CommandCenterKpiGridSkeleton />}>
          <CommandCenterKpis userId={userId} />
        </Suspense>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <section className="space-y-8 lg:col-span-7">
            <Suspense fallback={<CommandCenterAttentionSkeleton />}>
              <CommandCenterAttention userId={userId} />
            </Suspense>
            <Suspense fallback={<CommandCenterOnboardingTasksSkeleton />}>
              <CommandCenterOnboardingTasks userId={userId} />
            </Suspense>
          </section>
          <section className="lg:col-span-5">
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
