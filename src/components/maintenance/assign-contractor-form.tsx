"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { assignContractorFormState } from "@/lib/actions/maintenance";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full rounded-none bg-white py-6 text-[11px] font-bold uppercase tracking-[0.1em] text-black hover:bg-zinc-200 disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function AssignContractorForm({
  requestId,
  contractorName,
  contractorEmail,
  status,
}: {
  requestId: string;
  contractorName: string | null;
  contractorEmail: string | null;
  status: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(assignContractorFormState, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      setEditing(false);
    } else if (state && state.ok === false) {
      toast.error(state.error);
    }
  }, [state]);

  const s = (status ?? "").toLowerCase();
  const isResolved = s === "resolved";
  const hasContractor = Boolean(contractorName?.trim() || contractorEmail?.trim());
  const showForm = !isResolved && (!hasContractor || editing);

  const inputTone =
    "rounded-none border border-[#333333] bg-[#0B0B0B] text-[13px] text-zinc-200 placeholder:text-zinc-600 focus-visible:border-zinc-600";

  return (
    <div className="border border-[#333333] bg-[#161616]">
      <div className="border-b border-[#282828] px-5 py-4 md:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Contractor</p>
        <h3 className="mt-1 text-xs font-bold uppercase tracking-wider text-white">Contractor on file</h3>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-zinc-500">
          Saves who is handling this job in your workspace. It does{" "}
          <span className="font-semibold text-zinc-300">not</span> email the contractor. Outbound sends use{" "}
          <Link
            href="/dashboard/approvals"
            className="font-semibold text-[#afefdd] underline-offset-4 hover:underline"
          >
            Approvals
          </Link>
          .
        </p>
      </div>
      <div className="space-y-4 px-5 py-5 text-[12px] text-zinc-300 md:px-6 md:pb-6">
        {isResolved ? (
          <div className="space-y-2">
            <p>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Name</span>
              <br />
              <span className="text-[13px] text-zinc-200">{contractorName?.trim() || "—"}</span>
            </p>
            <p>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Email</span>
              <br />
              <span className="text-[13px] text-zinc-200">{contractorEmail?.trim() || "—"}</span>
            </p>
          </div>
        ) : hasContractor && !editing ? (
          <div className="space-y-4">
            <span className="inline-block border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
              Contractor assigned
            </span>
            <div className="space-y-2">
              <p>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Name</span>
                <br />
                <span className="text-[13px] text-zinc-200">{contractorName?.trim() || "—"}</span>
              </p>
              <p>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Email</span>
                <br />
                <span className="text-[13px] text-zinc-200">{contractorEmail?.trim() || "—"}</span>
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="rounded-none border-[#333333] bg-transparent text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:bg-[#141414]"
            >
              Edit
            </Button>
          </div>
        ) : null}

        {showForm ? (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="_requestId" value={requestId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="contractor-name" className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Contractor name
                </Label>
                <Input
                  id="contractor-name"
                  name="contractorName"
                  className={cn("h-10", inputTone)}
                  placeholder="e.g. John's Plumbing"
                  defaultValue={contractorName ?? ""}
                  required
                  autoComplete="organization"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="contractor-email" className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Contractor email
                </Label>
                <Input
                  id="contractor-email"
                  name="contractorEmail"
                  type="email"
                  className={cn("h-10", inputTone)}
                  placeholder="e.g. john@example.com"
                  defaultValue={contractorEmail ?? ""}
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              {hasContractor && editing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start rounded-none border-[#333333] bg-transparent text-[10px] font-bold uppercase tracking-wider text-zinc-500"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              ) : null}
              <SubmitButton label="Save contractor details" pendingLabel="Saving…" />
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
