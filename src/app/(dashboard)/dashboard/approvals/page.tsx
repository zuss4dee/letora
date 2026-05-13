export const dynamic = "force-dynamic";

import { Suspense } from "react";

import {
  ApprovalsQueueHealthSection,
  ApprovalsQueueSummarySkeleton,
  ApprovalsStaticShell,
  ApprovalsWorkspaceSection,
  ApprovalsWorkspaceSkeleton,
} from "./approvals-content";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const sp = await searchParams;
  const focusApprovalId = typeof sp.id === "string" && sp.id.trim().length > 0 ? sp.id.trim() : undefined;

  return (
    <div className="@container/main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="flex flex-col gap-5 md:gap-6">
          <ApprovalsStaticShell />
          <Suspense fallback={<ApprovalsQueueSummarySkeleton />}>
            <ApprovalsQueueHealthSection />
          </Suspense>
          <Suspense fallback={<ApprovalsWorkspaceSkeleton />}>
            <ApprovalsWorkspaceSection focusApprovalId={focusApprovalId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
