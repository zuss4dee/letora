"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function ActivityRowDetail({
  args,
  result,
}: {
  args: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          View
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Activity Details</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Arguments</h3>
            <pre className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {args ? JSON.stringify(args, null, 2) : "—"}
            </pre>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Result</h3>
            <pre className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {result ? JSON.stringify(result, null, 2) : "—"}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
