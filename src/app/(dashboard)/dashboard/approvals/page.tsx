import { Suspense } from "react";

import { ApprovalsContent } from "./approvals-content";
import { ApprovalsPageSkeleton } from "./approvals-page-skeleton";

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<ApprovalsPageSkeleton />}>
      <ApprovalsContent />
    </Suspense>
  );
}
