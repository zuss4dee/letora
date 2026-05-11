"use client";

import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

import { ApprovalsPendingInteractive } from "@/components/agents/approvals-pending-interactive";
import { ApprovalsResolvedSection } from "@/components/agents/approvals-resolved-section";
import { approvalActionTypeKey } from "@/lib/approvals/action-type-key";
import type { AgentApprovalActionType, AgentApprovalRow } from "@/lib/approvals/types";
import { MVP_TERMS } from "@/components/dashboard/workspace-terminology";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  return rows.filter((r) => approvalActionTypeKey(r.action_type) === f);
}

function ActionFilterChips({
  value,
  onChange,
  idPrefix,
  countsByAction,
  totalAll,
}: {
  value: ActionFilter;
  onChange: (v: ActionFilter) => void;
  idPrefix: string;
  /** Live counts from the same pending/resolved rows (keys normalized via {@link approvalActionTypeKey}). */
  countsByAction: Record<string, number>;
  totalAll: number;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {FILTERS.map((f) => {
        const active = value === f.value;
        const n =
          f.value === "all"
            ? totalAll
            : (countsByAction[f.value] ?? 0);
        return (
          <button
            key={`${idPrefix}-${f.value}`}
            type="button"
            onClick={() => onChange(f.value)}
            aria-pressed={active}
            className={cn(
              "border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
              active
                ? "border-zinc-900/25 bg-zinc-100 dark:bg-zinc-900/10 text-zinc-900 dark:border-white/20 dark:bg-white/10 dark:text-white"
                : "border-zinc-200/90 bg-transparent text-zinc-600 hover:text-zinc-900 dark:border-[#232323] dark:text-zinc-500 dark:hover:text-zinc-300",
            )}
          >
            {f.label}
            <span className="ml-1.5 tabular-nums opacity-60">({n})</span>
          </button>
        );
      })}
    </div>
  );
}

export function ApprovalsPageWorkspace({
  pending,
  resolved,
  pendingByActionType,
  focusApprovalId,
}: {
  pending: AgentApprovalRow[];
  resolved: AgentApprovalRow[];
  /** From {@link computeApprovalQueueStats}; same normalization as filter chips. */
  pendingByActionType: Record<string, number>;
  /** Deep-link from `/dashboard/approvals?id=` when present and valid. */
  focusApprovalId?: string;
}) {
  const [tab, setTab] = useState<"queue" | "decisions">("queue");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");

  const resolvedByActionType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const row of resolved) {
      const k = approvalActionTypeKey(row.action_type);
      if (!k) continue;
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [resolved]);

  const filteredPending = useMemo(
    () => sortOldestFirst(filterByAction(pending, actionFilter)),
    [pending, actionFilter],
  );

  const filteredResolved = useMemo(() => filterByAction(resolved, actionFilter), [resolved, actionFilter]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "queue" | "decisions")}
        className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-4"
      >
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-0 rounded-none border-b border-zinc-200/90 bg-transparent p-0 dark:border-[#232323] sm:w-auto sm:gap-8"
        >
          <TabsTrigger
            value="queue"
            className="rounded-none px-0 pb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 after:bottom-0 after:h-[2px] after:bg-zinc-100 dark:bg-zinc-900 data-[state=active]:text-zinc-900 dark:after:bg-white dark:data-[state=active]:text-white"
          >
            Queue
            {pending.length > 0 ? (
              <span className="ml-2 tabular-nums opacity-50">({pending.length})</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="decisions"
            className="rounded-none px-0 pb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 after:bottom-0 after:h-[2px] after:bg-zinc-100 dark:bg-zinc-900 data-[state=active]:text-zinc-900 dark:after:bg-white dark:data-[state=active]:text-white"
          >
            History
            {resolved.length > 0 ? (
              <span className="ml-2 tabular-nums opacity-50">({resolved.length})</span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-0 space-y-4 outline-none">
          {pending.length === 0 ? (
            <div className="border border-zinc-200 bg-white dark:border-white/[0.1] dark:bg-zinc-900">
              <EmptyState
                icon={CheckCircle2}
                title="All caught up"
                description="No approvals pending. Any rent chase drafts will appear here."
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 border border-zinc-200/90 bg-zinc-50 px-4 py-3 dark:border-[#232323] dark:bg-[#111111] sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Queue Filter
                  </p>
                </div>
                <ActionFilterChips
                  idPrefix="q"
                  value={actionFilter}
                  onChange={setActionFilter}
                  countsByAction={pendingByActionType}
                  totalAll={pending.length}
                />
              </div>
              {filteredPending.length === 0 ? (
                <section className="border border-dashed border-zinc-300 bg-zinc-50 p-5 dark:border-white/[0.12] dark:bg-[#111111]">
                  <p className="font-[family-name:var(--font-inter)] text-sm text-zinc-700 dark:text-zinc-300">
                    No {MVP_TERMS.pendingApproval.toLowerCase()} for the selected filter.
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.72rem] text-zinc-500">
                    Switch filter chips to return to the full approval queue.
                  </p>
                </section>
              ) : (
                <ApprovalsPendingInteractive
                  approvals={filteredPending}
                  emphasizeQueueAge
                  focusApprovalId={focusApprovalId}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="decisions" className="mt-0 space-y-4 outline-none">
          {resolved.length === 0 ? (
            <section className="border border-dashed border-zinc-300 bg-zinc-50 p-5 dark:border-white/[0.12] dark:bg-[#111111]">
              <p className="font-[family-name:var(--font-inter)] text-sm text-zinc-700 dark:text-zinc-300">No recent decisions yet.</p>
              <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.72rem] text-zinc-500">
                Approved and denied decisions will appear here for audit review.
              </p>
            </section>
          ) : (
            <>
              <div className="flex flex-col gap-2 border border-zinc-200/90 bg-zinc-50 px-4 py-3 dark:border-[#232323] dark:bg-[#111111] sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Decision History
                </p>
                <ActionFilterChips
                  idPrefix="d"
                  value={actionFilter}
                  onChange={setActionFilter}
                  countsByAction={resolvedByActionType}
                  totalAll={resolved.length}
                />
              </div>
              {filteredResolved.length === 0 ? (
                <section className="border border-dashed border-zinc-300 bg-zinc-50 p-5 dark:border-white/[0.12] dark:bg-[#111111]">
                  <p className="font-[family-name:var(--font-inter)] text-sm text-zinc-700 dark:text-zinc-300">
                    No decisions for the selected filter.
                  </p>
                </section>
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
