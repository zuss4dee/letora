"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ReviewDraftModal } from "@/components/email/review-draft-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MaintenanceEmailLogRow } from "@/lib/actions/maintenance";
import { reviewEmailDraft, sendEmailDraft } from "@/lib/actions/email-drafts";

function emailStatusBadge(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "sent") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Sent
      </Badge>
    );
  }
  if (s === "failed") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
      {s === "skipped" ? "Skipped" : "Draft"}
    </Badge>
  );
}

export function MaintenanceRelatedEmailsTable({
  emailLogs,
}: {
  emailLogs: MaintenanceEmailLogRow[];
}) {
  const router = useRouter();
  const [reviewDraft, setReviewDraft] = useState<Awaited<
    ReturnType<typeof reviewEmailDraft>
  > | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function handleSendNow(logId: string) {
    setSendingId(logId);
    try {
      await sendEmailDraft(logId);
      toast.success("Email sent.");
      setReviewOpen(false);
      setReviewDraft(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send email");
    } finally {
      setSendingId(null);
    }
  }

  async function handleReviewClick(logId: string) {
    try {
      const data = await reviewEmailDraft(logId);
      setReviewDraft(data);
      setReviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load draft");
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>To</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {emailLogs.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No emails logged yet. They appear after the maintenance agent runs.
              </TableCell>
            </TableRow>
          ) : (
            emailLogs.map((log) => {
              const isDraft = (log.status ?? "").toLowerCase() === "draft";
              return (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    {log.to_email ?? "—"}
                    {log.to_name ? (
                      <span className="block text-xs text-muted-foreground">{log.to_name}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">
                    {log.subject ?? "—"}
                  </TableCell>
                  <TableCell>{emailStatusBadge(log.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.sent_at
                      ? new Date(log.sent_at).toLocaleString("en-GB")
                      : log.created_at
                        ? new Date(log.created_at).toLocaleString("en-GB")
                        : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {isDraft ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleReviewClick(log.id)}
                        >
                          Review
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={sendingId === log.id}
                          className="bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800"
                          onClick={() => void handleSendNow(log.id)}
                        >
                          {sendingId === log.id ? "Sending…" : "Send now"}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <ReviewDraftModal
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) setReviewDraft(null);
        }}
        draft={reviewDraft}
        sending={reviewDraft != null && sendingId === reviewDraft.id}
        onSendNow={() => (reviewDraft ? handleSendNow(reviewDraft.id) : undefined)}
      />
    </>
  );
}
