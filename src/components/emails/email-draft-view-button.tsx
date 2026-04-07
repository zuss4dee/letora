"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function EmailDraftViewButton({
  subject,
  body,
  buttonClassName,
}: {
  subject: string;
  body: string;
  /** Optional styles for the Emails Sent table (compact / monolith). */
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "shrink-0",
          buttonClassName ??
            "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300",
        )}
        onClick={() => setOpen(true)}
      >
        View
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-[min(100%,36rem)] flex-col overflow-y-auto border-[#484848]/20 bg-[#0E0E0E] text-[#E7E5E4]"
        >
          <SheetHeader>
            <SheetTitle className="text-base text-[#C9C6C5]">{subject}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <div className="rounded-sm border border-[#484848]/20 bg-[#131313] p-4">
              <pre className="whitespace-pre-wrap break-words font-[family-name:var(--font-inter)] text-sm leading-relaxed text-[#ACABAA]">
                {body}
              </pre>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
