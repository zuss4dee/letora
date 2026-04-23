"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { assignContractorFormState } from "@/lib/actions/maintenance";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
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

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">Contractor on file</CardTitle>
        <CardDescription className="font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-foreground">
          Saves who is handling this job on your workspace only. It does <span className="font-medium text-foreground/90">not</span>{" "}
          email the contractor. Outbound contractor messages use{" "}
          <Link href="/dashboard/approvals" className="font-medium text-[#BD9952] underline-offset-4 hover:underline">
            Approvals
          </Link>{" "}
          (e.g. dispatch from the assistant with a contractor email).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4 text-sm">
        {isResolved ? (
          <div className="space-y-2">
            <p>
              <span className="text-muted-foreground">Name: </span>
              {contractorName?.trim() || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Email: </span>
              {contractorEmail?.trim() || "—"}
            </p>
          </div>
        ) : hasContractor && !editing ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
                In progress
              </Badge>
            </div>
            <div className="space-y-2">
              <p>
                <span className="text-muted-foreground">Name: </span>
                {contractorName?.trim() || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Email: </span>
                {contractorEmail?.trim() || "—"}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        ) : null}

        {showForm ? (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="_requestId" value={requestId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="contractor-name">Contractor name</Label>
                <Input
                  id="contractor-name"
                  name="contractorName"
                  className="w-full"
                  placeholder="e.g. John's Plumbing"
                  defaultValue={contractorName ?? ""}
                  required
                  autoComplete="organization"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="contractor-email">Contractor email</Label>
                <Input
                  id="contractor-email"
                  name="contractorEmail"
                  type="email"
                  className="w-full"
                  placeholder="e.g. john@example.com"
                  defaultValue={contractorEmail ?? ""}
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {hasContractor && editing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              ) : null}
              <SubmitButton label="Save contractor details" pendingLabel="Saving…" />
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
