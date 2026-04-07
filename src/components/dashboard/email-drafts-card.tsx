"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useDashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { ReviewDraftModal } from "@/components/email/review-draft-modal";
import { reviewEmailDraft, sendEmailDraft, type EmailDraftRow } from "@/lib/actions/email-drafts";
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

function formatAgentType(agentType: string) {
  return agentType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function EmailDraftsCard({
  drafts,
  className,
}: {
  drafts: EmailDraftRow[];
  className?: string;
}) {
  useDashboardPollRefresh();
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
      <Card
        className={className}
      >
        <CardHeader className={className ? "border-b border-[#484848]/15" : "border-b"}>
          <CardTitle className={className ? "font-headline text-foreground" : undefined}>
            Pending Email Drafts
          </CardTitle>
          <p
            className={
              className ? "text-sm font-normal text-muted-foreground" : "text-sm font-normal text-muted-foreground"
            }
          >
            Review and send messages when auto-send is off, or before they go out.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No pending drafts.
                  </TableCell>
                </TableRow>
              ) : (
                drafts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.to_name?.trim() || row.to_email}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{row.subject}</TableCell>
                    <TableCell>{formatAgentType(row.agent_type)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleReviewClick(row.id)}
                        >
                          Review
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800"
                          disabled={sendingId === row.id}
                          onClick={() => void handleSendNow(row.id)}
                        >
                          {sendingId === row.id ? "Sending…" : "Send now"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
