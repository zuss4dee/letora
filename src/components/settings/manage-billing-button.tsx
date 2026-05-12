"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Opens the billing customer portal (Polar when `provider` is `"polar"`).
 */
export function ManageBillingButton({
  provider = "polar",
  label,
}: {
  provider?: "stripe" | "polar";
  /** Defaults to “Manage Subscription”. */
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const endpoint = provider === "polar" ? "/api/polar/create-portal" : "/api/stripe/create-portal";
      const res = await fetch(endpoint, { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not open billing portal.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("Billing portal did not return a URL.");
    } catch {
      setError("Could not open billing portal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        data-testid="manage-billing"
        onClick={() => void onClick()}
        className="rounded-md border-border bg-card font-[family-name:var(--font-inter)] text-xs font-semibold uppercase tracking-[0.12em] text-foreground shadow-none transition-colors hover:border-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800/50 hover:text-white"
      >
        {pending ? "Opening…" : (label ?? "Manage Subscription")}
      </Button>
      {error ? (
        <p className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
