"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { updateLeadStatus } from "@/lib/actions/leads";

import { Button } from "@/components/ui/button";

export function LeadRowActions({
  leadId,
  allowQualifyReject,
}: {
  leadId: string;
  allowQualifyReject: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function onUpdate(status: "qualified" | "rejected") {
    const result = await updateLeadStatus(leadId, status);
    if (!result.ok) return;
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/dashboard/leads/${leadId}`}>View</Link>
      </Button>
      {allowQualifyReject ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => startTransition(() => void onUpdate("qualified"))}
          >
            Qualify
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => startTransition(() => void onUpdate("rejected"))}
          >
            Reject
          </Button>
        </>
      ) : null}
    </div>
  );
}

