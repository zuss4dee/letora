import {
  getPendingAgentApprovals,
  getRecentResolvedAgentApprovals,
} from "@/lib/actions/agent-approvals";
import { ApprovalsPageWorkspace } from "@/components/agents/approvals-page-workspace";
import { ApprovalsQueueSummary } from "@/components/agents/approvals-queue-summary";
import { computeApprovalQueueStats } from "@/lib/approvals/queue-stats";

export async function ApprovalsContent() {
  const [pending, resolved] = await Promise.all([
    getPendingAgentApprovals(),
    getRecentResolvedAgentApprovals(12),
  ]);
  const queueStats = computeApprovalQueueStats(pending);

  return (
    <div className="@container/main flex flex-1 flex-col gap-8 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="font-headline text-lg font-light tracking-tight text-foreground md:text-xl">Approvals</h1>
        <p className="max-w-xl font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-foreground">
          Everything here is <span className="text-foreground/90">pending approval</span> before Letora sends a
          tenant or contractor email. Use queue health for aging, the audit sheet per row for context, and recent
          decisions for what you already <span className="text-foreground/90">completed</span>.
        </p>
      </header>

      <ApprovalsQueueSummary stats={queueStats} />

      <section aria-label="Approvals workspace">
        <h2 className="sr-only">Approval queue and recent decisions</h2>
        <ApprovalsPageWorkspace pending={pending} resolved={resolved} />
      </section>
    </div>
  );
}
