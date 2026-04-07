"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function CollectRentButton({
  tenancyId,
  monthlyRent,
  tenantEmail,
}: {
  tenancyId: string;
  monthlyRent: number;
  tenantEmail?: string | null;
}) {
  void monthlyRent;
  const [loading, setLoading] = useState(false);

  async function handleCollect() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-rent-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenancyId, tenantEmail }),
      });

      if (!res.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Stripe checkout error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleCollect}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Creating...
        </>
      ) : (
        "Collect via Stripe"
      )}
    </Button>
  );
}
