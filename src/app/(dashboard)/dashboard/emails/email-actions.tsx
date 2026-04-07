"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  reviewEmailDraft,
  sendEmailDraft,
  type EmailDraftRow,
  type ReviewEmailDraftResult,
} from "@/lib/actions/email-drafts";

export function EmailRowActions({ email }: { email: EmailDraftRow }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [viewData, setViewData] = useState<ReviewEmailDraftResult | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  async function handleView() {
    setViewError(null);
    try {
      const data = await reviewEmailDraft(email.id);
      setViewData(data);
      setViewOpen(true);
    } catch (e) {
      setViewError(e instanceof Error ? e.message : "Could not load email");
    }
  }

  async function handleSend() {
    setSending(true);
    try {
      await sendEmailDraft(email.id);
      router.refresh();
    } catch (e) {
      console.error("Failed to send email:", e);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {email.status === "draft" ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleView()}
          >
            <Eye className="mr-1 size-3.5" aria-hidden />
            View
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={sending}
            onClick={() => void handleSend()}
          >
            {sending ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="mr-1 size-3.5" aria-hidden />
            )}
            Send
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleView()}
        >
          <Eye className="mr-1 size-3.5" aria-hidden />
          View
        </Button>
      )}

      {viewError ? (
        <span className="text-xs text-destructive">{viewError}</span>
      ) : null}

      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent side="right" className="flex w-[min(100%,36rem)] flex-col overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">{viewData?.subject ?? email.subject}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            {viewData?.to ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">To:</span> {viewData.to}
              </p>
            ) : null}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                {viewData?.body ?? email.body}
              </pre>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
