"use client";

import { useMemo, useState } from "react";

import { ApprovalsPendingInteractive } from "@/components/agents/approvals-pending-interactive";
import { ApprovalsResolvedSection } from "@/components/agents/approvals-resolved-section";
import type { AgentApprovalActionType, AgentApprovalRow } from "@/lib/approvals/types";
import { MVP_TERMS } from "@/components/dashboard/workspace-terminology";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionFilter = "all" | AgentApprovalActionType;

const FILTERS: { value: ActionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "send_onboarding_email", label: "Onboarding" },
  { value: "send_rent_chase_email", label: "Rent chase" },
  { value: "send_move_in_email", label: "Move-in" },
  { value: "approve_maintenance_dispatch", label: "Maintenance" },
];

function sortOldestFirst(rows: AgentApprovalRow[]): AgentApprovalRow[] {
  return [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function filterByAction(rows: AgentApprovalRow[], f: ActionFilter): AgentApprovalRow[] {
  if (f === "all") return rows;
  return rows.filter((r) => r.action_type === f);
}

function ActionFilterChips({
  value,
  onChange,
  idPrefix,
}: {
  value: ActionFilter;
  onChange: (v: ActionFilter) => void;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTERS.map((f) => {
        const active = value === f.value;
        return (
          <button
            key={`${idPrefix}-${f.value}`}
            type="button"
            onClick={() => onChange(f.value)}
            className={cn(
              "rounded-md border px-2.5 py-1 font-[family-name:var(--font-inter)] text-[0.62rem] font-medium uppercase tracking-[0.08em] transition-colors",
              active
                ? "border-[#BD9952]/45 bg-[#BD9952]/12 text-foreground dark:border-[#BD9952]/35 dark:bg-[#BD9952]/10"
                : "border-border/70 bg-muted/20 text-muted-foreground hover:bg-muted/35 dark:border-white/[0.08]",
            )}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

export function ApprovalsPageWorkspace({
  pending,
  resolved,
}: {
  pending: AgentApprovalRow[];
  resolved: AgentApprovalRow[];
}) {
  const [tab, setTab] = useState<"queue" | "decisions">("queue");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");

  const filteredPending = useMemo(
    () => sortOldestFirst(filterByAction(pending, actionFilter)),
    [pending, actionFilter],
  );

  const filteredResolved = useMemo(() => filterByAction(resolved, actionFilter), [resolved, actionFilter]);

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "queue" | "decisions")}
        className="w-full gap-5"
      >
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0 dark:border-[rgb(72_72_72_/0.12)] sm:w-auto sm:gap-8"
        >
          <TabsTrigger
            value="queue"
            className="rounded-none px-0 pb-3 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground after:bottom-0 after:h-[2px] after:bg-[#BD9952] data-[state=active]:text-foreground"
          >
            Queue
            {pending.length > 0 ? (
              <span className="ml-2 tabular-nums text-muted-foreground/80">({pending.length})</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="decisions"
            className="rounded-none px-0 pb-3 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground after:bottom-0 after:h-[2px] after:bg-[#BD9952] data-[state=active]:text-foreground"
          >
            Recent decisions
            {resolved.length > 0 ? (
              <span className="ml-2 tabular-nums text-muted-foreground/80">({resolved.length})</span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-0 space-y-4 outline-none">
          {pending.length === 0 ? (
            <Card className="border-border/80 dark:border-white/[0.06]">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0 border-b border-border/60 pb-4 dark:border-white/[0.06]">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/30 dark:border-white/[0.08]">
                  <Inbox className="size-4 text-muted-foreground" aria-hidden />
                </span>
                <div>
                  <CardTitle className="font-[family-name:var(--font-inter)] text-base font-semibold">
                    No {MVP_TERMS.pendingApprovals.toLowerCase()}
                  </CardTitle>
                  <p className="mt-1 font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
                    Tenant welcome, rent chases, move-in email, and contractor dispatch all stay in{" "}
                    {MVP_TERMS.pendingApproval.toLowerCase()} until you approve — then they&apos;re{" "}
                    {MVP_TERMS.sent.toLowerCase()}.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="py-6">
                <p className="text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
                  You&apos;re caught up — check the assistant on Home for the next task.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-[family-name:var(--font-inter)] text-[0.7rem] text-muted-foreground">
                  Filter by action type. Sorted oldest first.
                </p>
                <ActionFilterChips idPrefix="q" value={actionFilter} onChange={setActionFilter} />
              </div>
              {filteredPending.length === 0 ? (
                <p className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
                  No {MVP_TERMS.pendingApproval.toLowerCase()} for this filter.
                </p>
              ) : (
                <ApprovalsPendingInteractive approvals={filteredPending} emphasizeQueueAge />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="decisions" className="mt-0 space-y-4 outline-none">
          {resolved.length === 0 ? (
            <p className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
              No recent decisions yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-[family-name:var(--font-inter)] text-[0.7rem] text-muted-foreground">
                  Same filters apply to the decision log.
                </p>
                <ActionFilterChips idPrefix="d" value={actionFilter} onChange={setActionFilter} />
              </div>
              {filteredResolved.length === 0 ? (
                <p className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
                  No decisions for this filter.
                </p>
              ) : (
                <ApprovalsResolvedSection approvals={filteredResolved} className="pt-1" />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
