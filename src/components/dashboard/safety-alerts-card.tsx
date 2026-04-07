"use client";

import Link from "next/link";

import { useDashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SafetyAlertRow } from "@/lib/actions/safety-alerts";
import { normalizePropertyAddressLabel } from "@/lib/property-address";

function alertTitle(payload: SafetyAlertRow["payload"]) {
  if (!payload) return "Safety alert";
  const addr = normalizePropertyAddressLabel(payload.propertyAddress ?? "") || "Property";
  const summary = payload.issueSummary ?? "";
  const short = summary.length > 80 ? `${summary.slice(0, 77)}…` : summary;
  return `${addr}${short ? ` · ${short}` : ""}`;
}

export function SafetyAlertsCard({
  alerts,
  className,
}: {
  alerts: SafetyAlertRow[];
  className?: string;
}) {
  useDashboardPollRefresh();
  if (alerts.length === 0) return null;

  return (
    <Card
      className={
        className ??
        "border-red-300 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"
      }
    >
      <CardHeader
        className={
          className
            ? "border-b border-[#484848]/15"
            : "border-b border-red-200 dark:border-red-900/40"
        }
      >
        <CardTitle
          className={
            className ? "text-base text-[#E7E5E4]" : "text-base text-red-900 dark:text-red-100"
          }
        >
          Urgent safety alerts (last 7 days)
        </CardTitle>
        <p
          className={
            className
              ? "text-sm font-normal text-[#ACABAA]"
              : "text-sm font-normal text-red-800/90 dark:text-red-200/90"
          }
        >
          AI-flagged urgent-safety maintenance issues. Review and arrange professional help immediately.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {alerts.map((a) => {
          const payload = a.payload;
          const mid = payload?.maintenanceRequestId;
          return (
            <div
              key={a.id}
              className={
                className
                  ? "rounded-sm border border-[#484848]/15 bg-[#0E0E0E]/80 px-3 py-2 text-sm"
                  : "rounded-md border border-red-200 bg-white/90 px-3 py-2 text-sm dark:border-red-900/50 dark:bg-zinc-950/40"
              }
            >
              <p
                className={
                  className ? "font-medium text-[#BB5551]" : "font-medium text-red-950 dark:text-red-50"
                }
              >
                {alertTitle(payload)}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.created_at
                  ? new Date(a.created_at).toLocaleString("en-GB")
                  : "—"}
              </p>
              {mid ? (
                <Link
                  href={`/dashboard/maintenance/${mid}`}
                  className={
                    className
                      ? "mt-2 inline-block text-sm font-medium text-[#BD9952] underline-offset-4 hover:underline"
                      : "mt-2 inline-block text-sm font-medium text-red-800 underline-offset-4 hover:underline dark:text-red-300"
                  }
                >
                  View request
                </Link>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
