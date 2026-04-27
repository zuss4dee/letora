"use client";

import { useMemo, useState } from "react";

import { ApprovalsPendingInteractive } from "@/components/agents/approvals-pending-interactive";
import { ApprovalsResolvedSection } from "@/components/agents/approvals-resolved-section";
import { approvalActionTypeKey } from "@/lib/approvals/action-type-key";
import type { AgentApprovalActionType, AgentApprovalRow } from "@/lib/approvals/types";
import { MVP_TERMS } from "@/components/dashboard/workspace-terminology";
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
    <div className="flex flex-wrap gap-1.5">
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
              "border px-2.5 py-1 font-[family-name:var(--font-inter)] text-[0.62rem] font-medium uppercase tracking-[0.11em] transition-colors",
              active
                ? "border-white/25 bg-white/10 text-zinc-100"
                : "border-white/[0.08] bg-[#151515] text-zinc-500 hover:text-zinc-200",
            )}
          >
            {f.label}
            <span className="ml-1.5 tabular-nums text-[0.9em] opacity-80">({n})</span>
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
}: {
  pending: AgentApprovalRow[];
  resolved: AgentApprovalRow[];
  /** From {@link computeApprovalQueueStats}; same normalization as filter chips. */
  pendingByActionType: Record<string, number>;
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
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "queue" | "decisions")}
        className="w-full gap-4"
      >
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-0 rounded-none border-b border-white/[0.1] bg-transparent p-0 sm:w-auto sm:gap-7"
        >
          <TabsTrigger
            value="queue"
            className="rounded-none px-0 pb-3 font-[family-name:var(--font-inter)] text-[0.66rem] uppercase tracking-[0.16em] text-zinc-500 after:bottom-0 after:h-[2px] after:bg-white data-[state=active]:text-zinc-100"
          >
            Queue
            {pending.length > 0 ? (
              <span className="ml-2 tabular-nums text-muted-foreground/80">({pending.length})</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="decisions"
            className="rounded-none px-0 pb-3 font-[family-name:var(--font-inter)] text-[0.66rem] uppercase tracking-[0.16em] text-zinc-500 after:bottom-0 after:h-[2px] after:bg-white data-[state=active]:text-zinc-100"
          >
            Recent decisions
            {resolved.length > 0 ? (
              <span className="ml-2 tabular-nums text-muted-foreground/80">({resolved.length})</span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-0 space-y-4 outline-none">
          {pending.length === 0 ? (
            <section className="border border-white/[0.1] bg-[#121212] p-5">
              <p className="font-[family-name:var(--font-inter)] text-[0.66rem] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                Queue state
              </p>
              <p className="mt-2 font-[family-name:var(--font-inter)] text-sm font-medium text-zinc-100">
                No {MVP_TERMS.pendingApprovals.toLowerCase()} in queue
              </p>
              <p className="mt-1 max-w-3xl font-[family-name:var(--font-inter)] text-[0.78rem] leading-relaxed text-zinc-400">
                You&apos;re clear. New onboarding, rent chase, move-in, and maintenance recommendations will surface here
                for review before they are {MVP_TERMS.sent.toLowerCase()}.
              </p>
            </section>
          ) : (
            <>
              <div className="flex flex-col gap-3 border border-white/[0.1] bg-[#121212] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-[family-name:var(--font-inter)] text-[0.62rem] uppercase tracking-[0.14em] text-zinc-500">
                    Queue controls
                  </p>
                  <p className="font-[family-name:var(--font-inter)] text-[0.72rem] text-zinc-300">
                    Sorted oldest first. Select a row to inspect rationale and run decision actions.
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
              <div className="flex flex-wrap items-center gap-3 px-0.5">
                <p className="font-[family-name:var(--font-inter)] text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                  Status key
                </p>
                <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-inter)] text-[0.65rem] text-zinc-400">
                  <span className="size-2 bg-zinc-100" aria-hidden />
                  Selected
                </span>
                <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-inter)] text-[0.65rem] text-zinc-400">
                  <span className="size-2 bg-rose-300" aria-hidden />
                  Aging ({">"}48h)
                </span>
              </div>
              {filteredPending.length === 0 ? (
                <section className="border border-dashed border-white/[0.12] bg-[#111111] p-5">
                  <p className="font-[family-name:var(--font-inter)] text-sm text-zinc-300">
                    No {MVP_TERMS.pendingApproval.toLowerCase()} for the selected filter.
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.72rem] text-zinc-500">
                    Switch filter chips to return to the full approval queue.
                  </p>
                </section>
              ) : (
                <ApprovalsPendingInteractive approvals={filteredPending} emphasizeQueueAge />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="decisions" className="mt-0 space-y-4 outline-none">
          {resolved.length === 0 ? (
            <section className="border border-dashed border-white/[0.12] bg-[#111111] p-5">
              <p className="font-[family-name:var(--font-inter)] text-sm text-zinc-300">No recent decisions yet.</p>
              <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.72rem] text-zinc-500">
                Approved and denied decisions will appear here for audit review.
              </p>
            </section>
          ) : (
            <>
              <div className="flex flex-col gap-2 border border-white/[0.1] bg-[#121212] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-[family-name:var(--font-inter)] text-[0.7rem] text-zinc-400">
                  Use the same action filters on the decision log.
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
                <section className="border border-dashed border-white/[0.12] bg-[#111111] p-5">
                  <p className="font-[family-name:var(--font-inter)] text-sm text-zinc-300">
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
