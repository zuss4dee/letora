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
          "border-0 bg-muted font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground ring-1 ring-border dark:bg-[#0e0e0e]/70 dark:ring-[rgb(72_72_72_/0.12)]",
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
          "border-0 bg-amber-500/10 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-500",
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
          "border-0 bg-background dark:bg-[#142018]/85 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#9cd4a8] ring-1 ring-[#2d4a38]/50",
        )}
      >
        Complete
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="border-0 bg-card font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-[0.08em] text-foreground dark:bg-[#131313]/80"
    >
      {status}
    </Badge>
  );
}

function taskTypeBadge(type: string) {
  return (
    <span className="inline-flex rounded-[2px] border border-zinc-200/80 bg-zinc-100/50 px-2 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/35 dark:text-zinc-400">
      {type}
    </span>
  );
}

function taskStatusBadge(task: OnboardingTaskRow) {
  if (task.status === "complete") {
    return (
      <Badge
        className={cn(
          "border-0 bg-background dark:bg-[#142018]/85 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#9cd4a8] ring-1 ring-[#2d4a38]/50",
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
          "border-0 bg-background dark:bg-[#142018]/85 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#9cd4a8] ring-1 ring-[#2d4a38]/50",
        )}
      >
        Complete
      </Badge>
    );
  }
  if (task.status === "skipped") {
    return (
      <Badge className="border-0 bg-card font-[family-name:var(--font-inter)] text-[0.65rem] text-muted-foreground ring-1 ring-border dark:bg-[#131313]/80">
        Skipped
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        "border-0 bg-amber-500/10 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-500",
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
      <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-muted-foreground">
        Sent ✓ {new Date(task.email_sent_at).toLocaleString("en-GB")}
      </span>
    );
  }
  if (task.email_log_id && task.email_log_status === "draft") {
    return <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-amber-600 dark:text-amber-500">Draft ready</span>;
  }
  if (task.email_log_id && task.email_log_status === "failed") {
    return <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-[#e8a8a4]">Send failed</span>;
  }
  return (
    <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-muted-foreground">Scheduled / pending</span>
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
          <p className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
            Workflow
          </p>
          <CardTitle className={TENANCY_CARD_TITLE}>Tenant onboarding</CardTitle>
          <p className="max-w-2xl font-[family-name:var(--font-inter)] text-[12px] font-light leading-relaxed text-zinc-600 dark:text-zinc-400">
            Welcome emails, references, and move-in tasks. Track progress and mark manual steps done here.
          </p>
        </div>
        {onboardingStatusBadge(onboardingStatus)}
      </CardHeader>
      <CardContent className={`${TENANCY_CARD_CONTENT} space-y-6`}>
        {onboardingStatus === "not_started" ? (
          <div className="flex flex-col gap-4 rounded-[2px] border border-zinc-200/80 bg-zinc-100/40 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/25">
            <p className="max-w-xl font-[family-name:var(--font-inter)] text-[12px] font-light leading-relaxed text-zinc-600 dark:text-zinc-400">
              Creates welcome email (draft or send), reference checks, and move-in tasks.
            </p>
            <Button type="button" disabled={pending} onClick={() => void startOnboarding()} className={cn(TENANCY_PRIMARY_BTN, "shrink-0 px-6")}>
              {pending ? "Starting…" : "Start onboarding"}
            </Button>
          </div>
        ) : null}

        {onboardingStatus !== "not_started" && tasks.length > 0 ? (
          <div className="overflow-hidden rounded-[2px] border border-zinc-200/70 dark:border-zinc-800">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-zinc-100 dark:bg-[#131313] [&_tr]:border-0">
                <TableRow className="border-0 border-b border-zinc-200/70 hover:bg-transparent dark:border-zinc-800">
                  <TableHead className="w-12 text-center font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    Done
                  </TableHead>
                  <TableHead className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    Task
                  </TableHead>
                  <TableHead className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    Type
                  </TableHead>
                  <TableHead className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    Due
                  </TableHead>
                  <TableHead className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className="border-0 border-b border-zinc-200/60 last:border-0 hover:bg-zinc-100/80 dark:border-zinc-800 dark:hover:bg-zinc-200 dark:bg-zinc-800/35"
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
                        className="border-zinc-400/60 data-checked:border-emerald-500 data-checked:bg-emerald-500 data-checked:text-white dark:border-zinc-600"
                      />
                    </TableCell>
                    <TableCell className="font-[family-name:var(--font-inter)] text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                      {task.task_name}
                    </TableCell>
                    <TableCell>{taskTypeBadge(task.task_type)}</TableCell>
                    <TableCell className="font-[family-name:var(--font-inter)] text-[12px] text-zinc-600 dark:text-zinc-400">
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
          <p className="font-[family-name:var(--font-inter)] text-[12px] font-light text-zinc-500 dark:text-zinc-500">
            No onboarding tasks recorded yet.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
