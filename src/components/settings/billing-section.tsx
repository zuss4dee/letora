"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatPlan(plan: string | null) {
  if (!plan) return "No active plan";
  if (plan === "landlord_pro") return "Landlord Pro";
  if (plan === "starter") return "Starter";
  if (plan === "pro") return "Pro";
  return plan;
}

function statusBadge(status: string | null) {
  if (status === "active" || status === "trialing") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Active
      </Badge>
    );
  }
  if (status === "past_due") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        Past Due
      </Badge>
    );
  }
  return (
    <Badge className="border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
      Inactive
    </Badge>
  );
}

export function BillingSection() {
  const subscription = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onManageSubscription() {
    setPortalLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/create-portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Failed to open billing portal");
      window.location.href = data.url;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to open billing portal";
      setError(message);
      toast.error(message);
    } finally {
      setPortalLoading(false);
    }
  }

  const billingDate = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Billing</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        {subscription.loading ? (
          <div className="grid gap-3">
            <div className="h-4 w-52 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800" />
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800" />
            <div className="h-4 w-48 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Current plan</div>
                <div className="font-medium">{formatPlan(subscription.plan)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div>{statusBadge(subscription.status)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Next billing date</div>
                <div className="font-medium">{billingDate}</div>
              </div>
            </div>

            {error ? (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <Button type="button" onClick={onManageSubscription} disabled={portalLoading}>
                {portalLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening...
                  </>
                ) : (
                  "Manage Subscription"
                )}
              </Button>
              {(subscription.plan === "starter" || !subscription.isActive) ? (
                <Link href="/pricing" className="text-sm font-medium text-violet-400 hover:text-violet-300">
                  Upgrade Plan →
                </Link>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

