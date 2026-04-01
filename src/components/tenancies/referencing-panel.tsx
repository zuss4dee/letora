"use client";

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
  lastOutboundAt,
  lastInboundAt,
  onboardingStatus,
}: Props) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [override, setOverride] = useState(referencingAgencyEmailOverride ?? "");
  const [pending, startTransition] = useTransition();

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
          Send tenant and property details to your referencing provider. Replies to your Letora inbound
          address can advance onboarding when they include the LETORA_REF token.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
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

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSendHandoff} disabled={pending}>
            {pending ? "Working…" : "Send referencing handoff"}
          </Button>
          <Button type="button" variant="outline" onClick={onMarkComplete} disabled={pending}>
            Mark referencing complete (manual)
          </Button>
        </div>

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
