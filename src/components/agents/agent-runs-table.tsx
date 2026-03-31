"use client";

import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import type { AgentRun } from "@/lib/actions/agents";
import { cn } from "@/lib/utils";

export function formatAgentType(type: string): string {
  const map: Record<string, string> = {
    rent_chaser: "Rent Chaser",
    lead_qualifier: "Lead Qualifier",
    maintenance: "Maintenance",
    contract_drafter: "Contract Drafter",
    tenant_onboarding: "Tenant Onboarding",
    safety_alert: "Safety Alert",
  };
  if (map[type]) return map[type]!;
  return type
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function extractSummary(run: AgentRun): string {
  const p = run.payload;
  const count = p.count;
  const n = typeof count === "number" ? count : Number(count);

  if (run.agentType === "rent_chaser") {
    return Number.isFinite(n) && n > 0 ? `${n} payments chased` : "Ran";
  }
  if (run.agentType === "lead_qualifier") {
    return Number.isFinite(n) && n > 0 ? `${n} leads qualified` : "Ran";
  }
  if (run.agentType === "maintenance") {
    const addr = p.propertyAddress;
    const desc = p.description;
    if (typeof addr === "string" && addr.trim()) return addr;
    if (typeof desc === "string" && desc.trim()) return desc;
    return "Ran";
  }
  const addr = p.propertyAddress;
  const tenant = p.tenantName;
  if (typeof addr === "string" && addr.trim()) return addr;
  if (typeof tenant === "string" && tenant.trim()) return tenant;
  return "Ran";
}

export function timeAgo(isoString: string): string {
  const t = new Date(isoString).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  const base = "gap-1 font-normal capitalize";
  if (s === "completed") {
    return (
      <Badge
        className={cn(
          base,
          "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/15 dark:text-emerald-300",
        )}
      >
        {status}
      </Badge>
    );
  }
  if (s === "failed") {
    return (
      <Badge
        className={cn(
          base,
          "border border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-500/15 dark:text-red-300",
        )}
      >
        {status}
      </Badge>
    );
  }
  if (s === "running") {
    return (
      <Badge
        className={cn(
          base,
          "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/15 dark:text-amber-200",
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {status}
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        base,
        "border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300",
      )}
    >
      {status}
    </Badge>
  );
}

type AgentRunsTableProps = {
  initialRuns: AgentRun[];
};

export function AgentRunsTable({ initialRuns }: AgentRunsTableProps) {
  useDashboardPollRefresh();

  return (
    <div className="mt-8 space-y-3 px-4 lg:px-6">
      <h2 className="text-base font-semibold tracking-tight">Recent Agent Runs</h2>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-medium text-muted-foreground">History</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {initialRuns.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No agent runs yet.</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">{formatAgentType(run.agentType)}</TableCell>
                      <TableCell>{statusBadge(run.status)}</TableCell>
                      <TableCell className="max-w-[320px] text-muted-foreground text-sm">
                        {extractSummary(run)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                        {timeAgo(run.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
