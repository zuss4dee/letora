"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { approveAgentApproval, denyAgentApproval } from "@/lib/actions/agent-approvals";
import {
  formatApprovalAbsoluteTime,
  formatApprovalActionType,
  formatApprovalAgentType,
  formatApprovalRelativeTime,
  formatApprovalShortRelativeAge,
  formatApprovalTargetLine,
  isApprovalPendingStale,
} from "@/components/dashboard/approval-display";
import { ApprovalAuditSheetTrigger } from "@/components/agents/approval-audit-sheet";
import { MVP_TERMS } from "@/components/dashboard/workspace-terminology";
import type { AgentApprovalRow } from "@/lib/approvals/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ApprovalsPendingInteractive({
  approvals,
  emphasizeQueueAge = false,
}: {
  approvals: AgentApprovalRow[];
  /** When true, use compact ages, oldest-first context, and muted “Aging” signal (approvals ops view). */
  emphasizeQueueAge?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(approvals[0]?.id ?? null);
  const selectedApproval = useMemo(
    () => approvals.find((approval) => approval.id === selectedId) ?? approvals[0] ?? null,
    [approvals, selectedId],
  );

  const runApprove = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const r = await approveAgentApproval(id);
        if (r.ok) {
          toast.success("Approved", {
            description: "The requested action has been applied.",
          });
          router.refresh();
        } else {
          toast.error("Approval did not complete", { description: r.error });
        }
      } catch (e) {
        toast.error("Something went wrong", {
          description: e instanceof Error ? e.message : "Please try again.",
        });
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const runDeny = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const r = await denyAgentApproval(id);
        if (r.ok) {
          toast.success("Denied", {
            description: "This request was dismissed without running the action.",
          });
          router.refresh();
        } else {
          toast.error("Could not deny", { description: r.error });
        }
      } catch (e) {
        toast.error("Something went wrong", {
          description: e instanceof Error ? e.message : "Please try again.",
        });
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  return (
    <section className="grid gap-0 overflow-hidden border border-white/[0.1] bg-[#0f0f0f] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 overflow-hidden border-b border-white/[0.08] lg:border-b-0 lg:border-r lg:border-white/[0.08]">
        <div className="hidden border-b border-white/[0.08] bg-[#121212] px-3 py-2 lg:grid lg:grid-cols-[1.6fr_0.8fr_0.7fr_0.8fr] lg:gap-3">
          <p className="font-[family-name:var(--font-inter)] text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Case context
          </p>
          <p className="font-[family-name:var(--font-inter)] text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Agent
          </p>
          <p className="font-[family-name:var(--font-inter)] text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Urgency
          </p>
          <p className="font-[family-name:var(--font-inter)] text-right text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Age
          </p>
        </div>
        <ul className="divide-y divide-white/[0.06]">
          {approvals.map((approval) => {
            const targetLine = formatApprovalTargetLine(approval.target_type, approval.target_id);
            const stale = emphasizeQueueAge && isApprovalPendingStale(approval.created_at);
            const selected = approval.id === selectedApproval?.id;
            const ageLabel = emphasizeQueueAge
              ? formatApprovalShortRelativeAge(approval.created_at)
              : formatApprovalRelativeTime(approval.created_at);
            return (
              <li key={approval.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(approval.id)}
                  className={cn(
                    "w-full p-3 text-left transition-colors lg:grid lg:grid-cols-[1.6fr_0.8fr_0.7fr_0.8fr] lg:items-center lg:gap-3",
                    selected ? "bg-white/[0.05]" : "bg-transparent hover:bg-white/[0.02]",
                  )}
                  aria-current={selected ? "true" : undefined}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("size-1.5 shrink-0", stale ? "bg-rose-300" : selected ? "bg-zinc-100" : "bg-zinc-600")}
                        aria-hidden
                      />
                      <p className="truncate font-[family-name:var(--font-inter)] text-[0.78rem] font-medium text-zinc-100">
                        {approval.title}
                      </p>
                    </div>
                    <p className="mt-1 truncate font-[family-name:var(--font-inter)] text-[0.67rem] text-zinc-500">
                      {approval.summary ?? targetLine ?? "No context summary provided."}
                    </p>
                  </div>
                  <p className="mt-2 font-[family-name:var(--font-inter)] text-[0.66rem] text-zinc-400 lg:mt-0">
                    {formatApprovalAgentType(approval.agent_type)}
                  </p>
                  <div className="mt-2 lg:mt-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border px-2 py-0.5 font-[family-name:var(--font-inter)] text-[0.57rem] font-semibold uppercase tracking-[0.08em]",
                        stale
                          ? "border-rose-300/40 bg-rose-300/10 text-rose-200"
                          : "border-white/[0.16] bg-white/[0.04] text-zinc-300",
                      )}
                    >
                      {stale ? "Critical" : "Normal"}
                    </Badge>
                  </div>
                  <p className="mt-2 font-[family-name:var(--font-inter)] text-[0.66rem] tabular-nums text-zinc-500 lg:mt-0 lg:text-right">
                    {ageLabel}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <aside className="flex min-h-[22rem] flex-col bg-[#111111]">
        {selectedApproval ? (
          <>
            <div className="border-b border-white/[0.08] px-4 py-4">
              <p className="font-[family-name:var(--font-inter)] text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Decision panel
              </p>
              <h3 className="mt-2 font-[family-name:var(--font-inter)] text-base font-medium leading-tight text-zinc-100">
                {selectedApproval.title}
              </h3>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <section>
                <p className="font-[family-name:var(--font-inter)] text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Reasoning
                </p>
                <p className="mt-2 font-[family-name:var(--font-inter)] text-[0.75rem] leading-relaxed text-zinc-300">
                  {selectedApproval.summary ?? "No summary provided. Open audit context for full payload details."}
                </p>
              </section>
              <section className="space-y-2">
                <p className="font-[family-name:var(--font-inter)] text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Context
                </p>
                <div className="space-y-1.5">
                  <p className="font-[family-name:var(--font-inter)] text-[0.68rem] text-zinc-400">
                    Action: {formatApprovalActionType(selectedApproval.action_type)}
                  </p>
                  <p className="font-[family-name:var(--font-inter)] text-[0.68rem] text-zinc-400">
                    Agent: {formatApprovalAgentType(selectedApproval.agent_type)}
                  </p>
                  <p className="font-[family-name:var(--font-inter)] text-[0.68rem] text-zinc-400">
                    Created: {formatApprovalAbsoluteTime(selectedApproval.created_at)}
                  </p>
                  {formatApprovalTargetLine(selectedApproval.target_type, selectedApproval.target_id) ? (
                    <p className="font-[family-name:var(--font-inter)] text-[0.68rem] text-zinc-400">
                      Target: {formatApprovalTargetLine(selectedApproval.target_type, selectedApproval.target_id)}
                    </p>
                  ) : null}
                </div>
              </section>
              {emphasizeQueueAge && isApprovalPendingStale(selectedApproval.created_at) ? (
                <section className="border border-rose-300/20 bg-rose-300/5 p-2.5">
                  <p className="font-[family-name:var(--font-inter)] text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-rose-200">
                    {MVP_TERMS.aging}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.68rem] text-rose-100/90">
                    This approval has been waiting for over 48 hours and should be triaged first.
                  </p>
                </section>
              ) : null}
            </div>
            <div className="space-y-2 border-t border-white/[0.08] px-4 py-4">
              <Button
                type="button"
                disabled={busyId === selectedApproval.id}
                className="h-9 w-full border border-white/20 bg-zinc-100 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-black hover:bg-zinc-200"
                onClick={() => void runApprove(selectedApproval.id)}
              >
                {busyId === selectedApproval.id ? "…" : "Approve action"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busyId === selectedApproval.id}
                  className="h-8 border-white/[0.16] bg-transparent font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.1em] text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100"
                  onClick={() => void runDeny(selectedApproval.id)}
                >
                  {busyId === selectedApproval.id ? "…" : "Deny"}
                </Button>
                <ApprovalAuditSheetTrigger
                  approval={selectedApproval}
                  className="h-8 border-white/[0.16] bg-transparent font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.1em] text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100"
                />
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </section>
  );
}
