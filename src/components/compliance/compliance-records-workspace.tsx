"use client";

import { AlertTriangle, Clock3, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  ComplianceRecordsTabbedTable,
  type ComplianceRecordTabRow,
} from "@/components/compliance/compliance-records-tabbed-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadComplianceDocument } from "@/lib/actions/compliance";
import type { ComplianceType } from "@/lib/compliance/types";

export type ComplianceWorkspaceProperty = {
  id: string;
  address: string | null;
  city: string | null;
  postcode: string | null;
  hasGasSupply: boolean;
};

const ALL_TYPES: ComplianceType[] = ["EPC", "Gas Safety", "Electric Safety"];

function certTypesForProperty(hasGas: boolean): ComplianceType[] {
  return hasGas ? ALL_TYPES : ALL_TYPES.filter((t) => t !== "Gas Safety");
}

function propertyLabel(p: ComplianceWorkspaceProperty): string {
  const line1 = p.address?.split(",")[0]?.trim() || "Unnamed property";
  const loc = [p.city, p.postcode].filter(Boolean).join(", ");
  return loc ? `${line1} · ${loc}` : line1;
}

function displayCertificateLabel(type: ComplianceType): string {
  if (type === "Gas Safety") return "Gas safety (CP12)";
  if (type === "Electric Safety") return "EICR / Electrical safety";
  return "EPC rating";
}

type UploadDraft = {
  propertyId: string;
  certificateType: ComplianceType;
  documentLabel: string;
};

type ComplianceRecordsWorkspaceProps = {
  rows: ComplianceRecordTabRow[];
  properties: ComplianceWorkspaceProperty[];
  missingCount: number;
  expiringCount: number;
  compliancePct: number;
};

export function ComplianceRecordsWorkspace({
  rows,
  properties,
  missingCount,
  expiringCount,
  compliancePct,
}: ComplianceRecordsWorkspaceProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDraft, setUploadDraft] = useState<UploadDraft>({
    propertyId: "",
    certificateType: "EPC",
    documentLabel: "",
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === uploadDraft.propertyId) ?? null,
    [properties, uploadDraft.propertyId],
  );

  const typeOptions = useMemo(
    () => certTypesForProperty(selectedProperty?.hasGasSupply ?? true),
    [selectedProperty?.hasGasSupply],
  );

  const highlightRowId =
    uploadOpen && uploadDraft.propertyId
      ? `${uploadDraft.propertyId}-${uploadDraft.certificateType}`
      : null;

  function openUploadFromHeader() {
    if (properties.length === 0) {
      toast.message("No properties", {
        description: "Add a property first, then upload certificates.",
      });
      return;
    }
    const first = properties[0]!;
    const types = certTypesForProperty(first.hasGasSupply);
    setUploadDraft({
      propertyId: first.id,
      certificateType: types[0]!,
      documentLabel: "",
    });
    setUploadOpen(true);
  }

  function openUploadForRow(row: ComplianceRecordTabRow) {
    setUploadDraft({
      propertyId: row.propertyId,
      certificateType: row.certificateType,
      documentLabel: "",
    });
    setUploadOpen(true);
  }

  function closeUpload() {
    setUploadOpen(false);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    if (!uploadDraft.propertyId) {
      toast.error("Select a property.");
      return;
    }
    const p = properties.find((x) => x.id === uploadDraft.propertyId);
    if (!p) {
      toast.error("Property not found.");
      return;
    }
    if (!certTypesForProperty(p.hasGasSupply).includes(uploadDraft.certificateType)) {
      toast.error("This certificate type does not apply to the selected property.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const label = uploadDraft.documentLabel.trim();
      if (label.length > 0) {
        fd.append("documentLabel", label.slice(0, 200));
      }
      const result = await uploadComplianceDocument(uploadDraft.propertyId, uploadDraft.certificateType, fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(label ? `Uploaded: ${label}` : "Certificate uploaded");
      closeUpload();
      startTransition(() => router.refresh());
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="grid grid-cols-4 border-b border-zinc-800 bg-[#0B0B0B]">
        <div className="border-r border-zinc-800 p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Missing Certificates
          </p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold leading-none text-red-500">{missingCount}</span>
            <AlertTriangle className="mb-1 h-4 w-4 text-red-500/60" />
          </div>
        </div>
        <div className="border-r border-zinc-800 p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Expiring Soon</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold leading-none text-amber-500">{expiringCount}</span>
            <Clock3 className="mb-1 h-4 w-4 text-amber-500/60" />
          </div>
        </div>
        <div className="border-r border-zinc-800 p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Total Compliance</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold leading-none text-white">{compliancePct}%</span>
            <span className="mb-1 text-[10px] font-bold text-emerald-500">+0.4%</span>
          </div>
        </div>
        <div className="flex items-center justify-center p-4">
          <button
            type="button"
            onClick={openUploadFromHeader}
            className="inline-flex items-center gap-2 bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Certificate
          </button>
        </div>
      </div>

      <ComplianceRecordsTabbedTable
        rows={rows}
        selectedRowId={highlightRowId}
        onRowClick={openUploadForRow}
      />

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!open) closeUpload();
        }}
      >
        <DialogContent className="max-w-md border-zinc-800 bg-[#1A1A1A] text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">Upload certificate</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Choose the property and certificate type, then attach a PDF. Gas safety only appears for properties with
              gas supply.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="grid gap-2">
              <Label htmlFor="compliance-upload-property" className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Property
              </Label>
              <Select
                value={uploadDraft.propertyId || undefined}
                onValueChange={(propertyId) => {
                  const prop = properties.find((x) => x.id === propertyId);
                  const types = certTypesForProperty(prop?.hasGasSupply ?? true);
                  setUploadDraft((d) => ({
                    ...d,
                    propertyId,
                    certificateType: types.includes(d.certificateType) ? d.certificateType : types[0]!,
                  }));
                }}
              >
                <SelectTrigger
                  id="compliance-upload-property"
                  className="border-zinc-700 bg-[#0B0B0B] text-zinc-100"
                >
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-[#1A1A1A] text-zinc-100">
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="focus:bg-zinc-800">
                      {propertyLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="compliance-upload-type" className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Certificate type
              </Label>
              <Select
                value={uploadDraft.certificateType}
                onValueChange={(v) =>
                  setUploadDraft((d) => ({ ...d, certificateType: v as ComplianceType }))
                }
                disabled={!uploadDraft.propertyId}
              >
                <SelectTrigger
                  id="compliance-upload-type"
                  className="border-zinc-700 bg-[#0B0B0B] text-zinc-100"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-[#1A1A1A] text-zinc-100">
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t} className="focus:bg-zinc-800">
                      {displayCertificateLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="compliance-upload-label" className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Document name <span className="font-normal normal-case text-zinc-600">(optional)</span>
              </Label>
              <Input
                id="compliance-upload-label"
                value={uploadDraft.documentLabel}
                onChange={(e) =>
                  setUploadDraft((d) => ({ ...d, documentLabel: e.target.value.slice(0, 200) }))
                }
                placeholder="e.g. EPC 2026 – engineer copy"
                className="border-zinc-700 bg-[#0B0B0B] text-zinc-100 placeholder:text-zinc-600"
                autoComplete="off"
              />
            </div>
          </div>

          <p className="text-xs text-zinc-500">PDF only, max 15MB.</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onFile(f);
            }}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-600 bg-transparent text-zinc-200"
              disabled={uploading}
              onClick={closeUpload}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-white text-zinc-950 hover:bg-zinc-200"
              disabled={uploading || !uploadDraft.propertyId}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" aria-hidden />
                  Choose PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
