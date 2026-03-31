"use client";

import {
  DIALOG_FIELD_CLASS,
  DIALOG_FORM_STACK_CLASS,
  DIALOG_SINGLE_COLUMN_CLASS,
  dialogFormFooterClass,
} from "@/lib/ui/dialog-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ReviewDraftModalData = {
  id: string;
  to: string;
  subject: string;
  body: string;
};

type ReviewDraftModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReviewDraftModalData | null;
  sending: boolean;
  onSendNow: () => void | Promise<void>;
};

export function ReviewDraftModal({
  open,
  onOpenChange,
  draft,
  sending,
  onSendNow,
}: ReviewDraftModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${DIALOG_SINGLE_COLUMN_CLASS} max-h-[85vh] overflow-y-auto`}
      >
        <DialogHeader>
          <DialogTitle>Review email</DialogTitle>
          <DialogDescription>
            Read-only preview. Cancel to go back or send when you are ready.
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className={DIALOG_FORM_STACK_CLASS}>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="review-draft-to">To</Label>
              <Input
                id="review-draft-to"
                readOnly
                value={draft.to}
                className="bg-muted/40 text-foreground"
              />
            </div>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="review-draft-subject">Subject</Label>
              <Input
                id="review-draft-subject"
                readOnly
                value={draft.subject}
                className="bg-muted/40 text-foreground"
              />
            </div>
            <div className={DIALOG_FIELD_CLASS}>
              <Label htmlFor="review-draft-body">Body</Label>
              <Textarea
                id="review-draft-body"
                readOnly
                value={draft.body}
                className="min-h-[200px] resize-none font-sans bg-muted/40 text-foreground"
              />
            </div>
          </div>
        ) : null}

        <div className={dialogFormFooterClass()}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!draft || sending}
            className="bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800"
            onClick={() => void onSendNow()}
          >
            {sending ? "Sending…" : "Send now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
