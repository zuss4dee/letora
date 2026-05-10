"use client";

import {
  Bot,
  FileText,
  Home,
  PoundSterling,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";

import { useDashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
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

export type ActivityRun = {
  id: string;
  agent_type: string | null;
  status: string | null;
  created_at: string | null;
  payload: Record<string, unknown> | null;
};

function humanAgentName(agentType: string | null): string {
  const t = (agentType ?? "").toLowerCase();
  switch (t) {
    case "tenant_onboarding":
      return "Tenant Onboarding";
    case "rent_chaser":
      return "Rent Chaser";
    case "contract_drafter":
      return "Contract Drafter";
    case "maintenance_agent":
    case "maintenance":
      return "Maintenance";
    case "safety_alert":
      return "Safety alert";
    case "lead_qualifier":
      return "Lead Qualifier";
    default:
      if (!agentType) return "Unknown agent";
      return agentType
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function agentAccent(agentType: string | null): { iconBg: string; Icon: typeof Bot } {
  const t = (agentType ?? "").toLowerCase();
  if (t === "tenant_onboarding") {
    return { iconBg: "bg-indigo-500", Icon: Home };
  }
  if (t === "rent_chaser") {
    return { iconBg: "bg-amber-500", Icon: PoundSterling };
  }
  if (t === "lead_qualifier") {
    return { iconBg: "bg-teal-500", Icon: Users };
  }
  if (t === "contract_drafter") {
    return { iconBg: "bg-violet-500", Icon: FileText };
  }
  if (t === "maintenance_agent" || t === "maintenance") {
    return { iconBg: "bg-sky-500", Icon: Wrench };
  }
  if (t === "safety_alert") {
    return { iconBg: "bg-red-600", Icon: ShieldAlert };
  }
  return { iconBg: "bg-zinc-500", Icon: Bot };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function extractActivitySubtitle(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const countRaw = p.count;
  const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
  if (Number.isFinite(count) && count > 0) {
    return `${count} lead${count === 1 ? "" : "s"} processed`;
  }
  const tenantName = pickString(p, ["tenantName", "tenant_name"]);
  const rawAddress = pickString(p, ["propertyAddress", "property_address"]);
  const propertyAddress = rawAddress ? normalizePropertyAddressLabel(rawAddress) : null;
  if (tenantName || propertyAddress) {
    return [tenantName, propertyAddress].filter(Boolean).join(" · ");
  }
  const issueSummary = pickString(p, ["issueSummary"]);
  if (issueSummary) return issueSummary;
  const triage = p.triage;
  if (triage && typeof triage === "object") {
    const summary = pickString(triage as Record<string, unknown>, ["summary"]);
    if (summary) return summary;
  }
  return null;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 7) return rtf.format(-diffDay, "day");
  return new Date(iso).toLocaleDateString("en-GB");
}

function agentRunStatusBadge(status: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "completed") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        completed
      </Badge>
    );
  }
  if (normalized === "draft") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
        draft
      </Badge>
    );
  }
  if (normalized === "failed") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        failed
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-500/10 dark:text-blue-300"
    >
      {status ?? "unknown"}
    </Badge>
  );
}

export function AiActivityCard({ initialRuns }: { initialRuns: ActivityRun[] }) {
  useDashboardPollRefresh();

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>AI activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialRuns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No agent activity yet. Run an agent to see results here
                </TableCell>
              </TableRow>
            ) : (
              initialRuns.map((row) => {
                const { iconBg, Icon } = agentAccent(row.agent_type);
                const subtitle = extractActivitySubtitle(row.payload);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex gap-3">
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-900 dark:text-white shadow-sm ${iconBg}`}
                          aria-hidden
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium leading-tight">
                            {humanAgentName(row.agent_type)}
                          </div>
                          {subtitle ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {subtitle}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{agentRunStatusBadge(row.status)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(row.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
