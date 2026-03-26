"use client";

import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { useSubscription } from "@/hooks/useSubscription";
import { PLANS, type PlanKey } from "@/lib/stripe-plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const planEntries = Object.entries(PLANS) as Array<[PlanKey, (typeof PLANS)[PlanKey]]>;

function PricingContent() {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "true";
  const { isActive, loading } = useSubscription();
  const [dismissCancelled, setDismissCancelled] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<PlanKey | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showCancelledBanner = cancelled && !dismissCancelled;
  const popularPlan: PlanKey = "pro";

  async function startCheckout(planKey: PlanKey, priceId: string) {
    setCheckoutLoading(planKey);
    setError(null);
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, plan: planKey }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Failed to start checkout");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout");
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/create-portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Failed to open billing portal");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  }

  const subtitle = useMemo(
    () => "Choose the plan that fits your portfolio",
    [],
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 lg:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Simple, transparent pricing</h1>
          <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
        </div>

        {showCancelledBanner ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            <div className="flex items-center justify-between gap-4">
              <span>Payment cancelled. No charge was made.</span>
              <button
                type="button"
                className="text-xs underline underline-offset-2"
                onClick={() => setDismissCancelled(true)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          {planEntries.map(([planKey, plan]) => {
            const isPopular = planKey === popularPlan;
            return (
              <Card
                key={planKey}
                className={`relative border-zinc-800 bg-zinc-900/60 ${
                  isPopular ? "border-violet-500/60" : ""
                }`}
              >
                <CardHeader>
                  {isPopular ? (
                    <span className="mb-2 inline-flex w-fit rounded-full border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-200">
                      Most Popular
                    </span>
                  ) : null}
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="text-3xl font-semibold tracking-tight text-zinc-100">
                    £{plan.price}
                    <span className="ml-1 text-sm font-normal text-zinc-400">/mo</span>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <ul className="grid gap-2 text-sm text-zinc-300">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-violet-300" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {loading ? (
                    <Button disabled variant="outline">
                      Loading...
                    </Button>
                  ) : isActive ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openPortal}
                      disabled={portalLoading}
                    >
                      {portalLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opening...
                        </>
                      ) : (
                        "Manage Subscription"
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void startCheckout(planKey, plan.priceId)}
                      disabled={checkoutLoading === planKey}
                      className="bg-violet-600 text-white hover:bg-violet-700"
                    >
                      {checkoutLoading === planKey ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        "Get Started"
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/dashboard" className="text-zinc-100 underline underline-offset-4">
            Go to dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
          Loading…
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}

