"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ReviewDraftModal } from "@/components/email/review-draft-modal";
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
import { cn } from "@/lib/utils";

function emailStatusBadge(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "sent") {
    return (
      <span className="inline-flex border border-emerald-700/50 bg-emerald-950/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
        Sent
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span className="inline-flex border border-red-800/50 bg-red-950/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-300">
        Failed
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        s === "skipped"
          ? "border-zinc-600 bg-background dark:bg-[#141414] text-zinc-400"
          : "border-amber-800/40 bg-amber-950/30 text-amber-300",
      )}
    >
      {s === "skipped" ? "Skipped" : "Draft"}
    </span>
  );
}

const headClass =
  "h-10 border-b border-border dark:border-[#282828] bg-background dark:bg-[#0B0B0B] text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500";

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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className={headClass}>To</TableHead>
              <TableHead className={headClass}>Subject</TableHead>
              <TableHead className={headClass}>Status</TableHead>
              <TableHead className={headClass}>Sent</TableHead>
              <TableHead className={cn(headClass, "text-right")}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emailLogs.length === 0 ? (
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="border-b-0 py-10 text-center text-[12px] text-zinc-500"
                >
                  No emails logged yet. They appear after the maintenance agent runs.
                </TableCell>
              </TableRow>
            ) : (
              emailLogs.map((log) => {
                const isDraft = (log.status ?? "").toLowerCase() === "draft";
                return (
                  <TableRow
                    key={log.id}
                    className="border-b border-border dark:border-[#282828] hover:bg-background dark:bg-[#141414]/80"
                  >
                    <TableCell className="align-top text-[12px] font-medium text-zinc-200">
                      {log.to_email ?? "—"}
                      {log.to_name ? (
                        <span className="mt-0.5 block text-[11px] text-zinc-500">{log.to_name}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate align-top text-[12px] text-zinc-300">
                      {log.subject ?? "—"}
                    </TableCell>
                    <TableCell className="align-top">{emailStatusBadge(log.status)}</TableCell>
                    <TableCell className="align-top text-[12px] text-zinc-500">
                      {log.sent_at
                        ? new Date(log.sent_at).toLocaleString("en-GB")
                        : log.created_at
                          ? new Date(log.created_at).toLocaleString("en-GB")
                          : "—"}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      {isDraft ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleReviewClick(log.id)}
                            className="rounded-none border-border dark:border-[#333333] bg-transparent text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-background dark:bg-[#1a1a1a]"
                          >
                            Review
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={sendingId === log.id}
                            className="rounded-none border border-white/20 bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-black hover:bg-zinc-200 disabled:opacity-50"
                            onClick={() => void handleSendNow(log.id)}
                          >
                            {sendingId === log.id ? "Sending…" : "Send now"}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[12px] text-zinc-600">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
