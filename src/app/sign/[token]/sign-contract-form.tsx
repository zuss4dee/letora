"use client";

import { useState } from "react";

export function SignContractForm({ token }: { token: string }) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSign() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${token}`, { method: "POST" });
      const body = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }
      setSigned(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (signed) {
    return (
      <div className="border-t border-border px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
          <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">Contract Signed</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you — your signature has been recorded. Your landlord has been notified.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border px-6 py-5">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-sm text-muted-foreground">
          I have read and agree to the terms of this tenancy agreement
        </span>
      </label>

      {error && (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      )}

      <button
        type="button"
        disabled={!agreed || loading}
        onClick={handleSign}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Signing…" : "Sign Contract"}
      </button>
    </div>
  );
}
