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
      variant="default"
      className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
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
