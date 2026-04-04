"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmMoveIn } from "@/lib/actions/contracts-signing";

export function ConfirmMoveInButton({
  contractId,
  status,
}: {
  contractId: string;
  status: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isSigned = status === "signed";

  async function handleConfirm() {
    if (!isSigned) return;
    setLoading(true);
    setError(null);
    try {
      const result = await confirmMoveIn(contractId);
      if (!result.ok) {
        setError(result.error ?? "Failed to confirm move-in");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (status === "active") return null;

  return (
    <div className="relative inline-block">
      <div className="group">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isSigned || loading}
          className={
            isSigned
              ? "rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              : "rounded-lg bg-muted px-5 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed"
          }
        >
          {loading ? "Confirming…" : "Confirm Move-In →"}
        </button>
        {!isSigned && (
          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-md border border-border opacity-0 transition-opacity group-hover:opacity-100">
            Waiting for both signatures
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
