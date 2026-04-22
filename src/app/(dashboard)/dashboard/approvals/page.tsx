import { ApprovalsList } from "@/components/agents/approvals-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPendingAgentApprovals } from "@/lib/actions/agent-approvals";

export default async function ApprovalsPage() {
  const approvals = await getPendingAgentApprovals();

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-base font-semibold tracking-tight">Approvals</h1>
        <p className="text-sm text-muted-foreground">Review and decide high-impact agent actions.</p>
      </div>
      {approvals.length === 0 ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">No pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            New approval requests from agents will appear here.
          </CardContent>
        </Card>
      ) : (
        <ApprovalsList approvals={approvals} />
      )}
    </div>
  );
}
