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

import {
  TENANCY_CARD,
  TENANCY_CARD_CONTENT,
  TENANCY_CARD_HEADER,
  TENANCY_CARD_TITLE,
  TENANCY_LABEL,
  TENANCY_OUTLINE_BTN,
  TENANCY_PRIMARY_BTN,
} from "./tenancy-letora-surfaces";
import { EMAIL_INVALID_MESSAGE, optionalEmailSchema } from "@/lib/validations/email";
import { cn } from "@/lib/utils";

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

  const overrideCheck = optionalEmailSchema.safeParse(override);
  const overrideTrimmed = overrideCheck.success ? overrideCheck.data : "";
  const hasValidNonEmptyOverride = overrideTrimmed.length > 0;

  const canSendHandoff = hasDefaultReferencingAgencyEmail || hasValidNonEmptyOverride;

  const handoffRecipientEmail =
    hasValidNonEmptyOverride ? overrideTrimmed : (defaultReferencingAgencyEmail ?? "").trim() || null;

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
      toast.success("Referencing marked complete. Onboarding advanced to contract stage.");
      router.refresh();
      await refreshEvents();
    });
  }

  return (
    <Card className={TENANCY_CARD}>
      <CardHeader className={`${TENANCY_CARD_HEADER} space-y-3`}>
        <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#BD9952]/95">
          Referencing
        </p>
        <CardTitle className={TENANCY_CARD_TITLE}>Referencing agency</CardTitle>
        <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-muted-foreground">
          Your provider runs referencing and credit checks (they may email the tenant with their own link or
          process). Letora sends them a structured handoff with tenant and property details. Replies to your
          Letora inbound address that include the <span className="font-mono text-[0.7rem] text-foreground">LETORA_REF</span>{" "}
          line are logged here and may advance onboarding when the message looks like a clear pass or fail.
        </p>
      </CardHeader>
      <CardContent className={`${TENANCY_CARD_CONTENT} space-y-6`}>
        {!canSendHandoff ? (
          <div className="rounded-xl bg-[#2a1f0e]/50 p-4 ring-1 ring-[#BD9952]/25">
            <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-foreground">
              Add a <strong className="font-medium text-[#BD9952]">default agency email</strong> under{" "}
              <span className="whitespace-nowrap">Settings → Email &amp; Automation</span> (Default referencing
              agency), or enter an <strong className="font-medium">override for this tenancy</strong> below, before you can send a
              handoff.
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-3 inline-block font-[family-name:var(--font-inter)] text-sm font-medium text-[#BD9952] underline-offset-4 transition-colors hover:text-[#c9a660] hover:underline"
            >
              Open Settings
            </Link>
          </div>
        ) : null}

        <div className="grid gap-2 sm:max-w-md">
          <Label htmlFor="ref-override" className={TENANCY_LABEL}>
            Agency email override (this tenancy)
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="ref-override"
              type="email"
              placeholder="Uses Settings default if empty"
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              className="rounded-md border-border bg-background text-foreground placeholder:text-placeholder-foreground focus-visible:border-[#BD9952]/45 focus-visible:ring-1 focus-visible:ring-[#BD9952]/25 dark:border-[rgb(72_72_72_/0.28)] dark:bg-[#0e0e0e]/80"
            />
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                const check = optionalEmailSchema.safeParse(override);
                if (!check.success) {
                  toast.error(check.error.issues[0]?.message ?? EMAIL_INVALID_MESSAGE);
                  return;
                }
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
              className={cn(TENANCY_OUTLINE_BTN, "h-9 shrink-0 px-4")}
            >
              Save override
            </Button>
          </div>
        </div>

        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm ring-1 ring-border/60 dark:border-transparent dark:bg-[#0e0e0e]/35 dark:shadow-none dark:ring-[rgb(72_72_72_/0.08)]">
            <span className={TENANCY_LABEL}>Onboarding status</span>
            <p className="mt-1 font-[family-name:var(--font-inter)] font-medium capitalize text-foreground">
              {onboardingStatus.replace(/_/g, " ")}
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm ring-1 ring-border/60 dark:border-transparent dark:bg-[#0e0e0e]/35 dark:shadow-none dark:ring-[rgb(72_72_72_/0.08)]">
            <span className={TENANCY_LABEL}>Reference token</span>
            <p className="mt-1 break-all font-mono text-xs text-foreground">
              {referencingToken ?? "Not set (generated on first send)"}
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm ring-1 ring-border/60 dark:border-transparent dark:bg-[#0e0e0e]/35 dark:shadow-none dark:ring-[rgb(72_72_72_/0.08)]">
            <span className={TENANCY_LABEL}>Last handoff sent</span>
            <p className="mt-1 font-[family-name:var(--font-inter)] font-medium text-foreground">{fmt(lastOutboundAt)}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm ring-1 ring-border/60 dark:border-transparent dark:bg-[#0e0e0e]/35 dark:shadow-none dark:ring-[rgb(72_72_72_/0.08)]">
            <span className={TENANCY_LABEL}>Last agency reply (inbound)</span>
            <p className="mt-1 font-[family-name:var(--font-inter)] font-medium text-foreground">{fmt(lastInboundAt)}</p>
          </div>
        </div>

        {handoffRecipientEmail ? (
          <div className="rounded-xl border border-border bg-muted/60 px-4 py-3 font-[family-name:var(--font-inter)] text-xs leading-relaxed text-muted-foreground ring-1 ring-border/60 dark:border-transparent dark:bg-[#0e0e0e]/40 dark:ring-[rgb(72_72_72_/0.1)]">
            <span className="font-medium text-foreground">Handoff is emailed to </span>
            <span className="select-all break-all font-mono text-foreground">{handoffRecipientEmail}</span>
            <span className="text-muted-foreground">
              {" "}
              (the referencing agency, not your landlord inbox unless it is the same address). If you do not see
              it, check spam on that exact address or fix a typo in the override or under Settings → Email &amp;
              Automation.
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={onSendHandoff} disabled={pending || !canSendHandoff} className={cn(TENANCY_PRIMARY_BTN, "px-6")}>
            {pending ? "Working…" : "Send referencing handoff"}
          </Button>
          <Button type="button" variant="outline" onClick={onMarkComplete} disabled={pending} className={cn(TENANCY_OUTLINE_BTN, "h-10 px-5")}>
            Mark referencing complete (manual)
          </Button>
        </div>
        <p className="font-[family-name:var(--font-inter)] text-xs font-light leading-relaxed text-muted-foreground">
          When you receive the agency&apos;s final outcome (e.g. pass / fail / guarantor required), use{" "}
          <strong className="font-medium text-foreground">Mark referencing complete</strong> if Letora hasn&apos;t updated automatically from inbound
          email.
        </p>

        {events.length > 0 ? (
          <div className="border-t border-[rgb(72_72_72_/0.1)] pt-6">
            <p className={cn(TENANCY_LABEL, "mb-3")}>Recent activity</p>
            <ul className="space-y-2">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-xl bg-muted/70 px-4 py-3 ring-1 ring-border transition-colors hover:bg-muted dark:bg-[#0e0e0e]/35 dark:hover:bg-[#131313]/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-[family-name:var(--font-inter)] font-medium capitalize text-foreground">
                      {ev.direction}
                    </span>
                    <span className="font-[family-name:var(--font-inter)] text-[0.65rem] text-muted-foreground">{fmt(ev.createdAt)}</span>
                  </div>
                  {ev.outcome ? (
                    <p className="mt-1 font-[family-name:var(--font-inter)] text-xs text-muted-foreground">Outcome: {ev.outcome}</p>
                  ) : null}
                  {ev.subject ? <p className="mt-1 font-[family-name:var(--font-inter)] text-sm text-foreground">{ev.subject}</p> : null}
                  {ev.bodyPreview ? (
                    <p className="mt-1 line-clamp-2 font-[family-name:var(--font-inter)] text-xs text-muted-foreground">{ev.bodyPreview}</p>
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
