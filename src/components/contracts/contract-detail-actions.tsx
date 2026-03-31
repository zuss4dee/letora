"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteContract, updateContractStatus } from "@/lib/actions/contracts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ContractDetailActions({
  contractId,
  status,
}: {
  contractId: string;
  status: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const st = (status ?? "draft").toLowerCase();

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      toast.success("Updated.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (typeof window !== "undefined" && !window.confirm("Delete this contract?")) {
      return;
    }
    setBusy(true);
    try {
      await deleteContract(contractId);
      toast.success("Contract deleted.");
      router.push("/dashboard/contracts");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {st === "draft" ? (
          <Button
            type="button"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950"
            disabled={busy}
            onClick={() =>
              void run(() => updateContractStatus(contractId, "active"))
            }
          >
            Activate contract
          </Button>
        ) : null}

        {st === "active" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
              disabled={busy}
              onClick={() =>
                void run(() => updateContractStatus(contractId, "expired"))
              }
            >
              Mark as expired
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
              disabled={busy}
              onClick={() =>
                void run(() => updateContractStatus(contractId, "terminated"))
              }
            >
              Terminate
            </Button>
          </div>
        ) : null}

        <Button
          type="button"
          variant="destructive"
          className="w-full"
          disabled={busy}
          onClick={() => void handleDelete()}
        >
          Delete contract
        </Button>
      </CardContent>
    </Card>
  );
}
