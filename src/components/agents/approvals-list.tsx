import { approveAgentApproval, denyAgentApproval } from "@/lib/actions/agent-approvals";
import type { AgentApprovalRow } from "@/lib/approvals/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatAgentType(agentType: string): string {
  return agentType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatActionType(actionType: string): string {
  return actionType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApprovalsList({ approvals }: { approvals: AgentApprovalRow[] }) {
  return (
    <div className="space-y-3">
      {approvals.map((approval) => (
        <Card key={approval.id}>
          <CardHeader className="border-b">
            <CardTitle className="text-base">{approval.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {approval.summary ? (
              <p className="text-sm text-muted-foreground">{approval.summary}</p>
            ) : null}
            <div className="grid gap-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Agent:</span> {formatAgentType(approval.agent_type)}
              </p>
              <p>
                <span className="font-medium text-foreground">Action:</span> {formatActionType(approval.action_type)}
              </p>
              <p>
                <span className="font-medium text-foreground">Created:</span> {formatDate(approval.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form
                action={async () => {
                  "use server";
                  await approveAgentApproval(approval.id);
                }}
              >
                <Button
                  type="submit"
                  className="border border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-500 dark:border-emerald-900/40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Approve
                </Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await denyAgentApproval(approval.id);
                }}
              >
                <Button
                  type="submit"
                  className="border border-red-200 bg-red-600 text-white hover:bg-red-500 dark:border-red-900/40 dark:bg-red-600 dark:hover:bg-red-500"
                >
                  Deny
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
