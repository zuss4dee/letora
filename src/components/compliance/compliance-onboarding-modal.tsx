"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { uploadComplianceDocument } from "@/lib/actions/compliance";
import type { ComplianceType } from "@/lib/compliance/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ALL_ROWS: { type: ComplianceType; label: string; hint: string }[] = [
  { type: "EPC", label: "EPC", hint: "Energy performance" },
  { type: "Electric Safety", label: "Electrical (EICR)", hint: "Periodic inspection" },
  { type: "Gas Safety", label: "Gas safety (CP12)", hint: "Annual gas safety" },
];

function rowKey(propertyId: string, type: ComplianceType) {
  return `${propertyId}__${type}`;
}

export function ComplianceOnboardingModal({
  propertyId,
  hasGasSupply,
  open,
}: {
  propertyId: string | null;
  hasGasSupply: boolean;
  open: boolean;
}) {
  const router = useRouter();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const rows = hasGasSupply ? ALL_ROWS : ALL_ROWS.filter((r) => r.type !== "Gas Safety");

  function handleClose(next: boolean) {
    if (!next) {
      router.replace("/dashboard/compliance");
      router.refresh();
    }
  }

  async function onFile(propertyIdNonNull: string, type: ComplianceType, file: File | null) {
    if (!file) return;
    const key = rowKey(propertyIdNonNull, type);
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadComplianceDocument(propertyIdNonNull, type, fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Document received. You can confirm expiry dates on Compliance.");
      router.refresh();
    } finally {
      setUploadingKey(null);
      const input = fileRefs.current[key];
      if (input) input.value = "";
    }
  }

  if (!open || !propertyId) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg border-[#BD9952]/20 bg-card font-headline sm:max-w-lg">
        <DialogHeader className="space-y-3 text-left">
          <DialogTitle className="font-headline text-xl font-light tracking-tight text-foreground">
            Great start! Let&apos;s get your legal docs in order.
          </DialogTitle>
          <DialogDescription className="font-headline text-sm font-light leading-relaxed text-muted-foreground">
            Upload PDF certificates when you have them — you can always add or replace files later from Compliance.
            Expiry dates can be set there too.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 py-2">
          {rows.map((row) => {
            const rk = rowKey(propertyId, row.type);
            const busy = uploadingKey === rk;
            return (
              <li
                key={row.type}
                className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-4"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium leading-tight text-foreground">{row.label}</p>
                  <p className="text-[0.7rem] leading-relaxed text-muted-foreground">{row.hint}</p>
                </div>
                <div className="flex shrink-0 items-center justify-end sm:pt-0.5">
                  <input
                    ref={(el) => {
                      fileRefs.current[rk] = el;
                    }}
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    id={`onboard-upload-${rk}`}
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      void onFile(propertyId, row.type, f);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="rounded-full border-[#BD9952]/40 text-xs hover:bg-[#BD9952]/10"
                    onClick={() => fileRefs.current[rk]?.click()}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Upload className="mr-2 size-3.5 text-[#BD9952]" aria-hidden />
                    )}
                    Upload PDF
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            className="font-headline"
            onClick={() => {
              handleClose(false);
            }}
          >
            Done for now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
