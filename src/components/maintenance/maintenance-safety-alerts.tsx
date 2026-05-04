"use client";

import Link from "next/link";

import { AlertTriangle } from "lucide-react";

import type { SafetyAlertRow } from "@/lib/actions/safety-alerts";
import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function safetyAlertTitle(payload: SafetyAlertRow["payload"]) {
  if (!payload) return "Safety alert";
  const addr = normalizePropertyAddressLabel(payload.propertyAddress ?? "") || "Property";
  const summary = payload.issueSummary ?? "";
  const short = summary.length > 80 ? `${summary.slice(0, 77)}…` : summary;
  return `${addr}${short ? ` · ${short}` : ""}`;
}

export function MaintenanceSafetyAlerts({
  safetyAlerts,
  className,
}: {
  safetyAlerts: SafetyAlertRow[];
  className?: string;
}) {
  if (safetyAlerts.length === 0) return null;

  return (
    <div className={cn("mb-8 w-full max-w-4xl", className)}>
      <Card
        className={
          "border-red-300 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"
        }
      >
        <CardHeader className="border-b border-red-200 dark:border-red-900/40">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
            <CardTitle className="font-headline text-base text-red-900 dark:text-red-100">
              Urgent safety alerts (last 7 days)
            </CardTitle>
          </div>
          <p className="font-headline text-sm font-normal text-red-800/90 dark:text-red-200/90">
            AI-flagged urgent-safety maintenance issues. Review and arrange professional help immediately.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {safetyAlerts.map((a) => {
            const payload = a.payload;
            const mid = payload?.maintenanceRequestId;
            return (
              <div
                key={a.id}
                className="rounded-md border border-red-200 bg-white/90 px-3 py-2 text-sm dark:border-red-900/50 dark:bg-zinc-950/40"
              >
                <p className="font-headline font-medium text-red-950 dark:text-red-50">
                  {safetyAlertTitle(payload)}
                </p>
                <p className="mt-1 font-headline text-xs text-muted-foreground">
                  {a.created_at ? new Date(a.created_at).toLocaleString("en-GB") : "—"}
                </p>
                {mid ? (
                  <Link
                    href={`/dashboard/maintenance?issueId=${encodeURIComponent(mid)}`}
                    className="mt-2 inline-block font-headline text-sm font-medium text-red-800 underline-offset-4 hover:underline dark:text-red-300"
                  >
                    View request
                  </Link>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
