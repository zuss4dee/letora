"use client";

import { useFormStatus } from "react-dom";

import { resolveMaintenanceRequest } from "@/lib/actions/maintenance";

import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full rounded-none bg-emerald-600 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      {pending ? "Resolving…" : "Mark as resolved"}
    </Button>
  );
}

export function ResolveMaintenanceForm({ requestId }: { requestId: string }) {
  return (
    <form action={resolveMaintenanceRequest.bind(null, requestId)}>
      <SubmitButton />
    </form>
  );
}
