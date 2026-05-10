"use client";

import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PropertyCreatedCompliancePromptProps = {
  open: boolean;
  hasGasSupply: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadNow: () => void;
};

/**
 * Mercury-styled follow-up after a property is created — offer compliance uploads.
 */
export function PropertyCreatedCompliancePrompt({
  open,
  hasGasSupply,
  onOpenChange,
  onUploadNow,
}: PropertyCreatedCompliancePromptProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden border-border dark:border-[#BD9952]/25 bg-card p-0 font-headline shadow-[0_28px_56px_-32px_rgba(0,0,0,0.55)] sm:max-w-md">
        <div
          className="h-[3px] w-full bg-gradient-to-r from-[#BD9952] via-[#BD9952]/50 to-transparent"
          aria-hidden
        />
        <div className="relative px-6 pb-6 pt-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.08]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: "96px 96px",
            }}
          />
          <DialogHeader className="relative space-y-4 text-left">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border dark:border-[#BD9952]/40 bg-background dark:bg-[#BD9952]/10 text-[#BD9952]">
                <ShieldCheck className="size-6" strokeWidth={1.25} aria-hidden />
              </div>
              <div className="min-w-0 space-y-3 pt-0.5">
                <DialogTitle className="sr-only">
                  Property Secure — compliance certificates
                </DialogTitle>
                <DialogDescription asChild>
                  <p className="font-headline text-base font-light leading-relaxed text-foreground">
                    <span className="font-normal text-foreground">Property Secure.</span> Now, let&apos;s protect your
                    legal standing.{" "}
                    {hasGasSupply ? (
                      <>Would you like to upload your EPC and Gas Safety certificates now?</>
                    ) : (
                      <>
                        Would you like to upload your EPC certificate now? Gas supply is off for this property, so a gas
                        safety certificate isn&apos;t required.
                      </>
                    )}
                  </p>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogFooter className="relative mt-8 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              className="font-headline text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              Later
            </Button>
            <Button
              type="button"
              className="font-headline rounded-full border border-border dark:border-[#BD9952]/45 bg-background dark:bg-[#BD9952]/12 px-6 text-foreground shadow-sm transition hover:border-border dark:border-[#BD9952]/70 hover:bg-background dark:bg-[#BD9952]/20"
              onClick={onUploadNow}
            >
              Upload Now
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
