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
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }
      setSigned(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (signed) {
    return (
      <div className="border-t border-[rgb(72_72_72_/0.12)] bg-[#0e0e0e]/30 px-6 py-8 text-center sm:px-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="font-headline text-lg font-light tracking-tight text-foreground">Contract signed</h2>
        <p className="mt-2 font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-muted-foreground">
          Thank you. Your signature has been recorded. Your landlord has been notified.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-[rgb(72_72_72_/0.12)] bg-[#0e0e0e]/25 px-6 py-6 sm:px-8">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[rgb(72_72_72_/0.35)] bg-[#0e0e0e] accent-white"
        />
        <span className="font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
          I have read and agree to the terms of this tenancy agreement
        </span>
      </label>

      {error ? <p className="mt-3 font-[family-name:var(--font-inter)] text-sm text-[#e8a8a4]">{error}</p> : null}

      <button
        type="button"
        disabled={!agreed || loading}
        onClick={handleSign}
        className="mt-5 w-full rounded-md bg-white px-4 py-3 font-[family-name:var(--font-inter)] text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {loading ? "Signing…" : "Sign contract"}
      </button>
    </div>
  );
}
