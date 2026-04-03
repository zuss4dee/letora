"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getReferencingEvents,
  markReferencingCompleteManual,
  sendReferencingHandoff,
  updateReferencingAgencyOverride,
  type ReferencingEventRow,
} from "@/lib/actions/referencing";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  tenancyId: string;
  userId: string;
  initialEvents: ReferencingEventRow[];
  referencingToken: string | null;
  referencingAgencyEmailOverride: string | null;
  /** Default agency address from Settings (used when override is empty). */
  defaultReferencingAgencyEmail: string | null;
  /** True when Settings has a default referencing_agency_email (used if override is empty). */
  hasDefaultReferencingAgencyEmail: boolean;
  lastOutboundAt: string | null;
  lastInboundAt: string | null;
  onboardingStatus: string;
};

function fmt(ts: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return ts;
  }
}

export function ReferencingPanel({
  tenancyId,
  userId,
  initialEvents,
  referencingToken,
  referencingAgencyEmailOverride,
  defaultReferencingAgencyEmail,
  hasDefaultReferencingAgencyEmail,
  lastOutboundAt,
  lastInboundAt,
  onboardingStatus,
}: Props) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [override, setOverride] = useState(referencingAgencyEmailOverride ?? "");
  const [pending, startTransition] = useTransition();

  const canSendHandoff =
    hasDefaultReferencingAgencyEmail || override.trim().length > 0;

  const handoffRecipientEmail =
    override.trim() || (defaultReferencingAgencyEmail ?? "").trim() || null;

  async function refreshEvents() {
    const next = await getReferencingEvents(userId, tenancyId);
    setEvents(next);
  }

  function onSendHandoff() {
    startTransition(async () => {
      const result = await sendReferencingHandoff(tenancyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.sent ? "Email sent to referencing agency." : result.message);
      router.refresh();
      await refreshEvents();
    });
  }

  function onMarkComplete() {
    startTransition(async () => {
      const result = await markReferencingCompleteManual(tenancyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Referencing marked complete — onboarding advanced to contract stage.");
      router.refresh();
      await refreshEvents();
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-sm font-medium">Referencing agency</CardTitle>
        <p className="text-sm font-normal text-muted-foreground">
          Your provider runs referencing and credit checks (they may email the tenant with their own link or
          process). Letora sends them a structured handoff with tenant and property details. Replies to your
          Letora inbound address that include the <span className="font-mono text-xs">LETORA_REF</span> line
          are logged here and may advance onboarding when the message looks like a clear pass or fail.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {!canSendHandoff ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <p>
              Add a <strong>default agency email</strong> under{" "}
              <span className="whitespace-nowrap">Settings → Email &amp; Automation</span> (Default referencing
              agency), or enter an <strong>override for this tenancy</strong> below, before you can send a
              handoff.
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-2 inline-block font-medium text-foreground underline underline-offset-4"
            >
              Open Settings
            </Link>
          </div>
        ) : null}

        <div className="grid gap-2 sm:max-w-md">
          <Label htmlFor="ref-override">Agency email override (this tenancy)</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="ref-override"
              type="email"
              placeholder="Uses Settings default if empty"
              value={override}
              onChange={(e) => setOverride(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const r = await updateReferencingAgencyOverride(tenancyId, override);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Override saved.");
                  router.refresh();
                });
              }}
            >
              Save override
            </Button>
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Onboarding status</span>
            <p className="font-medium capitalize">{onboardingStatus.replace(/_/g, " ")}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Reference token</span>
            <p className="font-mono text-xs break-all">{referencingToken ?? "— (generated on first send)"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Last handoff sent</span>
            <p className="font-medium">{fmt(lastOutboundAt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Last agency reply (inbound)</span>
            <p className="font-medium">{fmt(lastInboundAt)}</p>
          </div>
        </div>

        {handoffRecipientEmail ? (
          <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Handoff is emailed to </span>
            <span className="select-all break-all font-mono text-foreground">{handoffRecipientEmail}</span>
            <span className="text-muted-foreground">
              {" "}
              (the referencing agency — not your landlord inbox unless it is the same address). If you do not see
              it, check spam on that exact address or fix a typo in the override or under Settings → Email &amp;
              Automation.
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSendHandoff} disabled={pending || !canSendHandoff}>
            {pending ? "Working…" : "Send referencing handoff"}
          </Button>
          <Button type="button" variant="outline" onClick={onMarkComplete} disabled={pending}>
            Mark referencing complete (manual)
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          When you receive the agency&apos;s final outcome (e.g. pass / fail / guarantor required), use{" "}
          <strong>Mark referencing complete</strong> if Letora hasn&apos;t updated automatically from inbound
          email.
        </p>

        {events.length > 0 ? (
          <div className="border-t pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent activity</p>
            <ul className="mt-2 space-y-2 text-sm">
              {events.map((ev) => (
                <li key={ev.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium capitalize">{ev.direction}</span>
                    <span className="text-xs text-muted-foreground">{fmt(ev.createdAt)}</span>
                  </div>
                  {ev.outcome ? (
                    <p className="text-xs text-muted-foreground">Outcome: {ev.outcome}</p>
                  ) : null}
                  {ev.subject ? <p className="text-xs">{ev.subject}</p> : null}
                  {ev.bodyPreview ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ev.bodyPreview}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
