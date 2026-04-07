"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Opens Stripe Customer Portal (POST /api/stripe/create-portal). Used in E2E and for landlords
 * who need billing without hunting through menus.
 */
export function ManageBillingButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/stripe/create-portal", { method: "POST" });
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
        className="rounded-md border-[rgb(72_72_72_/0.28)] bg-[#131313]/60 font-[family-name:var(--font-inter)] text-xs font-semibold uppercase tracking-[0.12em] text-foreground shadow-none transition-colors hover:border-[#BD9952]/45 hover:bg-[#BD9952]/10 hover:text-[#BD9952]"
      >
        {pending ? "Opening…" : "Manage billing"}
      </Button>
      {error ? (
        <p className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
