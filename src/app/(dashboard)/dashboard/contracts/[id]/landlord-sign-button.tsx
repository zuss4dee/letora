"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signContractAsLandlord } from "@/lib/actions/contracts-signing";

export function LandlordSignButton({
  contractId,
  tenantSigned,
}: {
  contractId: string;
  tenantSigned: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSign() {
    setLoading(true);
    setError(null);
    try {
      const result = await signContractAsLandlord(contractId);
      if (!result.ok) {
        setError(result.error ?? "Failed to sign");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSign}
        disabled={loading}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Signing…" : "Sign as Landlord"}
      </button>
      {!tenantSigned && (
        <p className="mt-2 text-xs text-muted-foreground">
          The tenant has not signed yet. You can sign first. The contract will be fully executed once both parties have signed.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
