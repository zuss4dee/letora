"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { completeManualOnboardingTask, type OnboardingTaskRow } from "@/lib/actions/onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

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
      <Badge className="border border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
        {label}
      </Badge>
    );
  }
  if (s === "in_progress" || s === "references" || s === "contract_sent") {
    return (
      <Badge className="border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-500/10 dark:text-blue-300">
        {label}
      </Badge>
    );
  }
  if (s === "complete") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Complete
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

function taskTypeBadge(type: string) {
  return (
    <Badge variant="outline" className="capitalize">
      {type}
    </Badge>
  );
}

function taskStatusBadge(task: OnboardingTaskRow) {
  if (task.status === "complete") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Complete
      </Badge>
    );
  }
  if (task.email_log_status === "sent") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Complete
      </Badge>
    );
  }
  if (task.status === "skipped") {
    return <Badge variant="secondary">Skipped</Badge>;
  }
  return (
    <Badge className="border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
      Pending
    </Badge>
  );
}

function emailTaskLabel(task: OnboardingTaskRow) {
  if (task.task_type !== "email") return null;
  if (task.email_log_status === "sent" && task.email_sent_at) {
    return (
      <span className="text-xs text-muted-foreground">
        Sent ✓ {new Date(task.email_sent_at).toLocaleString("en-GB")}
      </span>
    );
  }
  if (task.email_log_id && task.email_log_status === "draft") {
    return <span className="text-xs text-amber-700 dark:text-amber-400">Draft ready</span>;
  }
  if (task.email_log_id && task.email_log_status === "failed") {
    return <span className="text-xs text-red-600">Send failed</span>;
  }
  return <span className="text-xs text-muted-foreground">Scheduled / pending</span>;
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
          ? `Onboarding started — ${data.tasksCreated} tasks created`
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

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b">
        <CardTitle className="text-base">Onboarding</CardTitle>
        {onboardingStatusBadge(onboardingStatus)}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {onboardingStatus === "not_started" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={pending} onClick={() => void startOnboarding()}>
              {pending ? "Starting…" : "Start onboarding"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Creates welcome email (draft or send), reference checks, and move-in tasks.
            </p>
          </div>
        ) : null}

        {onboardingStatus !== "not_started" && tasks.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.task_name}</TableCell>
                  <TableCell>{taskTypeBadge(task.task_type)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
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
                  <TableCell className="text-right">
                    {task.task_type === "manual" && task.status === "pending" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={taskLoadingId === task.id}
                        onClick={() => void markManualComplete(task.id)}
                      >
                        {taskLoadingId === task.id ? "Saving…" : "Mark complete"}
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}

        {onboardingStatus !== "not_started" && tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No onboarding tasks recorded yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
