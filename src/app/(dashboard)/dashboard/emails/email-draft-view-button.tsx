"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function EmailDraftViewButton({
  subject,
  body,
}: {
  subject: string;
  body: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        View
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-[min(100%,36rem)] flex-col overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">{subject}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                {body}
              </pre>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
