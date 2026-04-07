"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteLead,
  type LeadPipelineStatus,
  type LeadQualifiedStatus,
  updateLeadQualifiedStatus,
  updateLeadStatus,
} from "@/lib/actions/leads";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PIPELINE: { value: LeadPipelineStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "viewing", label: "Viewing" },
  { value: "applied", label: "Applied" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const QUALIFIED: { value: LeadQualifiedStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Disqualified" },
];

function normalizePipeline(s: string): LeadPipelineStatus {
  const v = s.toLowerCase() as LeadPipelineStatus;
  return PIPELINE.some((p) => p.value === v) ? v : "new";
}

function normalizeQualified(s: string): LeadQualifiedStatus {
  const v = s.toLowerCase() as LeadQualifiedStatus;
  return QUALIFIED.some((p) => p.value === v) ? v : "pending";
}

export function LeadRowActions({
  leadId,
  status,
  qualifiedStatus,
  variant = "inline",
}: {
  leadId: string;
  status: string;
  qualifiedStatus: string;
  /** `menu` uses a compact overflow trigger for dense tables */
  variant?: "inline" | "menu";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const st = normalizePipeline(status);
  const qs = normalizeQualified(qualifiedStatus);

  async function onStatus(next: LeadPipelineStatus) {
    try {
      await updateLeadStatus(leadId, next);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  }

  async function onQualified(next: LeadQualifiedStatus) {
    try {
      await updateLeadQualifiedStatus(leadId, next);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update qualification");
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this lead? This cannot be undone.")) return;
    try {
      await deleteLead(leadId);
      toast.success("Lead deleted.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete lead");
    }
  }

  const controls = (
    <>
      <div className="space-y-1">
        <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#767575]">
          Pipeline
        </p>
        <Select
          value={st}
          disabled={isPending}
          onValueChange={(v) =>
            startTransition(() => void onStatus(v as LeadPipelineStatus))
          }
        >
          <SelectTrigger className="h-8 w-full min-w-[10rem] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {PIPELINE.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <p className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#767575]">
          Qualification
        </p>
        <Select
          value={qs}
          disabled={isPending}
          onValueChange={(v) =>
            startTransition(() => void onQualified(v as LeadQualifiedStatus))
          }
        >
          <SelectTrigger className="h-8 w-full min-w-[10rem] text-xs">
            <SelectValue placeholder="Qualified" />
          </SelectTrigger>
          <SelectContent>
            {QUALIFIED.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-destructive hover:text-destructive"
        disabled={isPending}
        onClick={() => startTransition(() => void onDelete())}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete lead
      </Button>
    </>
  );

  if (variant === "menu") {
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[#ACABAA] hover:bg-[#1F2020] hover:text-[#E7E5E4]"
            disabled={isPending}
            aria-label="Lead actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-72 border-[#484848]/20 bg-[#131313] p-3"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-3">{controls}</div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Select
        value={st}
        disabled={isPending}
        onValueChange={(v) =>
          startTransition(() => void onStatus(v as LeadPipelineStatus))
        }
      >
        <SelectTrigger className="h-8 w-[min(100%,11rem)] min-w-[7.5rem] text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {PIPELINE.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={qs}
        disabled={isPending}
        onValueChange={(v) =>
          startTransition(() => void onQualified(v as LeadQualifiedStatus))
        }
      >
        <SelectTrigger className="h-8 w-[min(100%,10rem)] min-w-[7rem] text-xs">
          <SelectValue placeholder="Qualified" />
        </SelectTrigger>
        <SelectContent>
          {QUALIFIED.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        disabled={isPending}
        aria-label="Delete lead"
        onClick={() => startTransition(() => void onDelete())}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
