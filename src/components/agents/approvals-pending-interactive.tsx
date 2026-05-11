"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { approveAgentApproval, denyAgentApproval } from "@/lib/actions/agent-approvals";
import {
  formatApprovalActionType,
  formatApprovalAgentType,
  formatApprovalShortRelativeAge,
  formatApprovalTargetLine,
  isApprovalPendingStale,
} from "@/components/dashboard/approval-display";
import { ApprovalAuditSheetTrigger } from "@/components/agents/approval-audit-sheet";
import type { AgentApprovalRow } from "@/lib/approvals/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ApprovalsPendingInteractive({
  approvals,
  emphasizeQueueAge = false,
  focusApprovalId,
}: {
  approvals: AgentApprovalRow[];
  /** When true, use compact ages, oldest-first context, and muted “Aging” signal (approvals ops view). */
  emphasizeQueueAge?: boolean;
  /** Optional selection from `/dashboard/approvals?id=` when it matches a pending row. */
  focusApprovalId?: string;
}) {
  const router = useRouter();
  void emphasizeQueueAge;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const first = approvals[0]?.id ?? null;
    const pick = focusApprovalId?.trim();
    if (pick && approvals.some((a) => a.id === pick)) return pick;
    return first;
  });
  
  const selectedApproval = useMemo(
    () => approvals.find((approval) => approval.id === selectedId) ?? approvals[0] ?? null,
    [approvals, selectedId],
  );

  useEffect(() => {
    if (approvals.length === 0) {
      setSelectedId(null);
      return;
    }
    const pick = focusApprovalId?.trim();
    if (pick && approvals.some((a) => a.id === pick)) {
      setSelectedId(pick);
      return;
    }
    if (!selectedId || !approvals.some((a) => a.id === selectedId)) {
      setSelectedId(approvals[0]!.id);
    }
  }, [approvals, selectedId, focusApprovalId]);

  const runApprove = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const r = await approveAgentApproval(id);
        if (r.ok === false) {
          toast.error("Approval did not complete", { description: r.error });
          return;
        }
        toast.success("Approved and executed", {
          description: `${formatApprovalActionType(r.actionType)} — operational data will refresh.`,
        });
        router.refresh();
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
        if (r.ok === false) {
          toast.error("Could not deny", { description: r.error });
          return;
        }
        toast.success("Denied", {
          description: "Dismissed with no send or data change. Activity log updated.",
        });
        router.refresh();
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
    <div className="flex min-h-[600px] flex-1 border border-zinc-200/90 bg-zinc-50 dark:border-[#232323] dark:bg-[#0e0e0e]">
      {/* Queue List */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-zinc-200/90 dark:border-[#232323]">
        <div className="sticky top-0 z-10 grid grid-cols-12 border-b border-zinc-200/90 bg-zinc-100 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-600 dark:border-[#232323] dark:bg-[#111111] dark:text-zinc-400">
          <div className="col-span-12 md:col-span-5">Case / Context</div>
          <div className="hidden md:block md:col-span-3">Action Type</div>
          <div className="hidden md:block md:col-span-2">Agent</div>
          <div className="hidden text-right md:block md:col-span-2">Age</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {approvals.map((approval) => {
            const isSelected = selectedApproval?.id === approval.id;
            const isStale = isApprovalPendingStale(approval.created_at);
            const actionTypeLabel = formatApprovalActionType(approval.action_type);
            const ageLabel = formatApprovalShortRelativeAge(approval.created_at);
            
            return (
              <button
                key={approval.id}
                onClick={() => setSelectedId(approval.id)}
                className={cn(
                  "grid w-full grid-cols-12 items-center px-3 py-3 text-left transition-colors hover:bg-zinc-100 md:gap-0 dark:bg-[#1b1b1b] dark:hover:bg-[#222]",
                  isSelected ? "bg-zinc-100 dark:bg-[#1a1a1a]" : "border-b border-zinc-200/70 bg-transparent dark:border-[#232323]/50"
                )}
              >
                <div className="col-span-12 flex items-center gap-3 pr-2 md:col-span-5 md:pr-4">
                  <div className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    isStale ? "bg-rose-400" : isSelected ? "bg-zinc-100 dark:bg-zinc-900 dark:bg-white" : "bg-zinc-400 dark:bg-zinc-700"
                  )} />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-zinc-900 dark:text-white">
                      {approval.title}
                    </p>
                    <p className="truncate text-[10px] text-zinc-500 uppercase tracking-tight">
                      {formatApprovalTargetLine(approval.target_type, approval.target_id) ?? "System"}
                    </p>
                  </div>
                </div>
                <div className="hidden md:col-span-3 md:block">
                  <span className={cn(
                    "inline-block border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-zinc-800",
                    approval.action_type.includes("onboarding") &&
                      "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-400",
                    approval.action_type.includes("rent_chase") &&
                      "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400",
                    approval.action_type.includes("move_in") &&
                      "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400",
                    approval.action_type.includes("maintenance") &&
                      "border-purple-500/40 bg-purple-500/10 text-purple-800 dark:text-purple-400",
                  )}
                >
                    {actionTypeLabel}
                  </span>
                </div>
                <div className="hidden md:col-span-2 md:block">
                  <span className="text-[11px] text-zinc-700 dark:text-zinc-400">
                  {formatApprovalAgentType(approval.agent_type)}
                  </span>
                </div>
                <div className="hidden text-right md:col-span-2 md:block">
                  <span className="text-[11px] font-medium tabular-nums text-zinc-700 dark:text-zinc-500">{ageLabel}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Decision Inspector */}
      <aside className="flex w-[420px] shrink-0 flex-col bg-white dark:bg-[#111111]">
        {selectedApproval ? (
          <>
            <div className="shrink-0 border-b border-zinc-200/90 p-6 dark:border-[#232323]">
              <p className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Decision Inspector</p>
              <h2 className="text-xl font-bold leading-tight text-zinc-900 dark:text-white mb-6">
                {selectedApproval.title}
              </h2>
              
              {/* Proposed Action Summary Block */}
              <div className="border border-zinc-200/90 bg-zinc-50 p-4 dark:border-[#2f2f2f] dark:bg-[#161616]">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">Proposed Action</p>
                <p className="text-[13px] font-medium text-zinc-900 leading-relaxed dark:text-white">
                  {selectedApproval.summary ?? "Execution of the requested operational task."}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6">
              {/* Maintenance Context */}
              {selectedApproval.action_type === "approve_maintenance_dispatch" && (
                <section>
                  <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Maintenance Context</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Category</p>
                      <p className="text-[11px] font-medium text-zinc-900 dark:text-white">{(selectedApproval.payload.category as string) ?? "—"}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Priority</p>
                      <p className="text-[11px] font-medium text-zinc-900 dark:text-white">{(selectedApproval.payload.priority as string) ?? "—"}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Linked Entities */}
              <section>
                <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Associated Context</h3>
                <div className="space-y-2">
                  {!!selectedApproval.payload.tenantId && (
                    <Link
                      href={`/dashboard/tenants/${selectedApproval.payload.tenantId as string}`}
                      className="flex items-center justify-between border border-zinc-200/90 px-3 py-2 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-[#232323] dark:text-zinc-400 dark:hover:bg-background dark:bg-[#1b1b1b]"
                    >
                      <span>Tenant Record</span>
                      <span className="font-bold text-zinc-900 dark:text-white">VIEW</span>
                    </Link>
                  )}
                  {!!selectedApproval.payload.propertyId && (
                    <Link
                      href={`/dashboard/properties/${selectedApproval.payload.propertyId as string}`}
                      className="flex items-center justify-between border border-zinc-200/90 px-3 py-2 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-[#232323] dark:text-zinc-400 dark:hover:bg-background dark:bg-[#1b1b1b]"
                    >
                      <span>Property Record</span>
                      <span className="font-bold text-zinc-900 dark:text-white">VIEW</span>
                    </Link>
                  )}
                </div>
              </section>

              {/* Audit / Reasoning */}
              <section>
                <h3 className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Agent Rationale</h3>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  {selectedApproval.evidence.rationale as string ?? "This action was surfaced based on predefined operational rules for " + selectedApproval.agent_type + "."}
                </p>
              </section>
            </div>

            {/* Decision Actions */}
            <div className="shrink-0 border-t border-zinc-200/90 bg-zinc-50 p-6 dark:border-[#232323] dark:bg-[#0B0B0B]">
              <div className="grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  disabled={busyId === selectedApproval.id}
                  className="border border-transparent bg-green-600 py-6 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-green-700 dark:border-[#9ad7c3]/20 dark:bg-[#152420] dark:text-[#9ad7c3] dark:hover:bg-[#1a2e29]"
                  onClick={() => {
                    if (selectedApproval.action_type === "send_rent_chase_email") {
                      router.push(`/dashboard/approvals/${selectedApproval.id}/email`);
                      return;
                    }
                    void runApprove(selectedApproval.id);
                  }}
                >
                  {busyId === selectedApproval.id ? "Processing..." : "Approve & Execute Action"}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    disabled={busyId === selectedApproval.id}
                    variant="outline"
                    className="border-zinc-300 bg-transparent py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-800 transition-colors hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:border-[#333333] dark:text-white dark:hover:bg-rose-900/20 dark:hover:text-rose-400 dark:hover:border-rose-900/50"
                    onClick={() => void runDeny(selectedApproval.id)}
                  >
                    Reject
                  </Button>
                  <ApprovalAuditSheetTrigger
                    approval={selectedApproval}
                    className="border-zinc-300 bg-transparent py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-[#333333] dark:text-zinc-400 dark:hover:bg-zinc-100 dark:bg-zinc-900"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Select a case to inspect</p>
          </div>
        )}
      </aside>
    </div>
  );
}
