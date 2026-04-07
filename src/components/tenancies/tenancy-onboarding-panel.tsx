"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  completeManualOnboardingTask,
  revertOnboardingTaskToPending,
  type OnboardingTaskRow,
} from "@/lib/actions/onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import {
  TENANCY_CARD,
  TENANCY_CARD_CONTENT,
  TENANCY_CARD_HEADER,
  TENANCY_CARD_TITLE,
  TENANCY_PRIMARY_BTN,
} from "./tenancy-letora-surfaces";

function onboardingStatusBadge(status: string) {
  const s = status.toLowerCase();
  const label =
    s === "not_started"
      ? "Not started"
      : s === "in_progress"
        ? "In progress"
        : s === "contract_sent"
          ? "Contract sent"
          : status.replace(/_/g, " ");
  if (s === "not_started") {
    return (
      <Badge
        className={cn(
          "border-0 bg-[#0e0e0e]/70 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#ACABAA] ring-1 ring-[rgb(72_72_72_/0.12)]",
        )}
      >
        {label}
      </Badge>
    );
  }
  if (s === "in_progress" || s === "references" || s === "contract_sent") {
    return (
      <Badge
        className={cn(
          "border-0 bg-[#BD9952]/12 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#c9a660] ring-1 ring-[#BD9952]/35",
        )}
      >
        {label}
      </Badge>
    );
  }
  if (s === "complete") {
    return (
      <Badge
        className={cn(
          "border-0 bg-[#142018]/85 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#9cd4a8] ring-1 ring-[#2d4a38]/50",
        )}
      >
        Complete
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="border-0 bg-[#131313]/80 font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-[0.08em] text-[#C9C6C5]"
    >
      {status}
    </Badge>
  );
}

function taskTypeBadge(type: string) {
  return (
    <span className="inline-flex rounded-md bg-[#0e0e0e]/50 px-2 py-0.5 font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.08em] text-[#ACABAA] ring-1 ring-[rgb(72_72_72_/0.1)]">
      {type}
    </span>
  );
}

function taskStatusBadge(task: OnboardingTaskRow) {
  if (task.status === "complete") {
    return (
      <Badge
        className={cn(
          "border-0 bg-[#142018]/85 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#9cd4a8] ring-1 ring-[#2d4a38]/50",
        )}
      >
        Complete
      </Badge>
    );
  }
  if (task.email_log_status === "sent") {
    return (
      <Badge
        className={cn(
          "border-0 bg-[#142018]/85 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#9cd4a8] ring-1 ring-[#2d4a38]/50",
        )}
      >
        Complete
      </Badge>
    );
  }
  if (task.status === "skipped") {
    return (
      <Badge className="border-0 bg-[#131313]/80 font-[family-name:var(--font-inter)] text-[0.65rem] text-[#ACABAA] ring-1 ring-[rgb(72_72_72_/0.12)]">
        Skipped
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        "border-0 bg-[#2a1f0e]/85 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#BD9952] ring-1 ring-[#BD9952]/25",
      )}
    >
      Pending
    </Badge>
  );
}

function emailTaskLabel(task: OnboardingTaskRow) {
  if (task.task_type !== "email") return null;
  if (task.email_log_status === "sent" && task.email_sent_at) {
    return (
      <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-[#ACABAA]">
        Sent ✓ {new Date(task.email_sent_at).toLocaleString("en-GB")}
      </span>
    );
  }
  if (task.email_log_id && task.email_log_status === "draft") {
    return <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-[#BD9952]">Draft ready</span>;
  }
  if (task.email_log_id && task.email_log_status === "failed") {
    return <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-[#e8a8a4]">Send failed</span>;
  }
  return (
    <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-[#ACABAA]">Scheduled / pending</span>
  );
}

export function TenancyOnboardingPanel({
  tenancyId,
  onboardingStatus,
  tasks,
}: {
  tenancyId: string;
  onboardingStatus: string;
  tasks: OnboardingTaskRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [taskLoadingId, setTaskLoadingId] = useState<string | null>(null);

  async function startOnboarding() {
    startTransition(async () => {
      const res = await fetch("/api/agents/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenancyId }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        tasksCreated?: number;
      };
      if (!res.ok || !data.success) {
        toast.error(data.message ?? "Onboarding failed");
        return;
      }
      toast.success(
        data.tasksCreated != null
          ? `Onboarding started: ${data.tasksCreated} tasks created`
          : "Onboarding started",
      );
      router.refresh();
    });
  }

  async function markManualComplete(taskId: string) {
    setTaskLoadingId(taskId);
    const result = await completeManualOnboardingTask(taskId);
    setTaskLoadingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Task marked complete");
    router.refresh();
  }

  async function revertToPending(taskId: string) {
    setTaskLoadingId(taskId);
    const result = await revertOnboardingTaskToPending(taskId);
    setTaskLoadingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Task moved back to pending");
    router.refresh();
  }

  return (
    <Card className={TENANCY_CARD}>
      <CardHeader className={`${TENANCY_CARD_HEADER} flex flex-row flex-wrap items-start justify-between gap-3`}>
        <div className="space-y-2">
          <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#BD9952]/95">
            Workflow
          </p>
          <CardTitle className={TENANCY_CARD_TITLE}>Tenant onboarding</CardTitle>
          <p className="max-w-2xl font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-[#ACABAA]">
            Welcome emails, references, and move-in tasks. Track progress and mark manual steps done here.
          </p>
        </div>
        {onboardingStatusBadge(onboardingStatus)}
      </CardHeader>
      <CardContent className={`${TENANCY_CARD_CONTENT} space-y-6`}>
        {onboardingStatus === "not_started" ? (
          <div className="flex flex-col gap-4 rounded-xl bg-[#0e0e0e]/35 p-5 ring-1 ring-[rgb(72_72_72_/0.1)] sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-[#ACABAA]">
              Creates welcome email (draft or send), reference checks, and move-in tasks.
            </p>
            <Button type="button" disabled={pending} onClick={() => void startOnboarding()} className={cn(TENANCY_PRIMARY_BTN, "shrink-0 px-6")}>
              {pending ? "Starting…" : "Start onboarding"}
            </Button>
          </div>
        ) : null}

        {onboardingStatus !== "not_started" && tasks.length > 0 ? (
          <div className="overflow-hidden rounded-xl ring-1 ring-[rgb(72_72_72_/0.08)]">
            <Table>
              <TableHeader className="[&_tr]:border-0">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="w-12 text-center font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#ACABAA]">
                    Done
                  </TableHead>
                  <TableHead className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#ACABAA]">
                    Task
                  </TableHead>
                  <TableHead className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#ACABAA]">
                    Type
                  </TableHead>
                  <TableHead className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#ACABAA]">
                    Due
                  </TableHead>
                  <TableHead className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#ACABAA]">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className="border-0 border-b border-[rgb(72_72_72_/0.06)] last:border-0 hover:bg-[#0e0e0e]/45"
                  >
                    <TableCell className="text-center align-middle">
                      <Checkbox
                        checked={task.status === "complete"}
                        disabled={
                          (task.status !== "pending" && task.status !== "complete") ||
                          taskLoadingId === task.id
                        }
                        aria-label={
                          task.status === "complete"
                            ? `Mark ${task.task_name} as not done`
                            : `Mark ${task.task_name} complete`
                        }
                        onCheckedChange={(checked) => {
                          if (checked === true && task.status === "pending") {
                            void markManualComplete(task.id);
                          }
                          if (checked === false && task.status === "complete") {
                            void revertToPending(task.id);
                          }
                        }}
                        className="border-[rgb(72_72_72_/0.35)] data-checked:border-[#BD9952] data-checked:bg-[#BD9952] data-checked:text-[#2c1e00]"
                      />
                    </TableCell>
                    <TableCell className="font-[family-name:var(--font-inter)] font-medium text-[#E7E5E4]">
                      {task.task_name}
                    </TableCell>
                    <TableCell>{taskTypeBadge(task.task_type)}</TableCell>
                    <TableCell className="font-[family-name:var(--font-inter)] text-sm text-[#ACABAA]">
                      {task.due_date
                        ? new Date(`${task.due_date}T12:00:00.000Z`).toLocaleDateString("en-GB")
                        : task.task_type === "email"
                          ? "Immediate"
                          : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {taskStatusBadge(task)}
                        {emailTaskLabel(task)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {onboardingStatus !== "not_started" && tasks.length === 0 ? (
          <p className="font-[family-name:var(--font-inter)] text-sm font-light text-[#ACABAA]">
            No onboarding tasks recorded yet.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
