import { Suspense } from "react";

import {
  ApprovalsQueueHealthSection,
  ApprovalsQueueSummarySkeleton,
  ApprovalsStaticShell,
  ApprovalsWorkspaceSection,
  ApprovalsWorkspaceSkeleton,
} from "./approvals-content";

export default function ApprovalsPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-5 bg-[#0B0B0B] p-4 md:gap-6 md:p-6">
      <ApprovalsStaticShell />
      <Suspense fallback={<ApprovalsQueueSummarySkeleton />}>
        <ApprovalsQueueHealthSection />
      </Suspense>
      <Suspense fallback={<ApprovalsWorkspaceSkeleton />}>
        <ApprovalsWorkspaceSection />
      </Suspense>
    </div>
  );
}
