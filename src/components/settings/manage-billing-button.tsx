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
      >
        {pending ? "Opening…" : "Manage billing"}
      </Button>
      {error ? (
        <p className="text-sm text-muted-foreground" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
