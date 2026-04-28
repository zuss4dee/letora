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
      <CardHeader className={`${TENANCY_CARD_HEADER} space-y-2`}>
        <p className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
          Referencing
        </p>
        <CardTitle className={TENANCY_CARD_TITLE}>Referencing agency</CardTitle>
        <p className="font-[family-name:var(--font-inter)] text-[12px] font-light leading-relaxed text-zinc-600 dark:text-zinc-400">
          Your provider runs referencing and credit checks (they may email the tenant with their own link or
          process). Letora sends them a structured handoff with tenant and property details. Replies to your
          Letora inbound address that include the{" "}
          <span className="font-mono text-[0.7rem] text-zinc-900 dark:text-zinc-100">LETORA_REF</span>{" "}
          line are logged here and may advance onboarding when the message looks like a clear pass or fail.
        </p>
      </CardHeader>
      <CardContent className={`${TENANCY_CARD_CONTENT} space-y-6`}>
        {!canSendHandoff ? (
          <div className="rounded-[2px] border border-amber-200/70 bg-amber-50/90 p-4 dark:border-amber-900/45 dark:bg-amber-950/30">
            <p className="font-[family-name:var(--font-inter)] text-[12px] font-light leading-relaxed text-zinc-800 dark:text-zinc-200">
              Add a <strong className="font-medium text-zinc-900 dark:text-zinc-100">default agency email</strong> under{" "}
              <span className="whitespace-nowrap">Settings → Email &amp; Automation</span> (Default referencing
              agency), or enter an <strong className="font-medium text-zinc-900 dark:text-zinc-100">override for this tenancy</strong>{" "}
              below, before you can send a handoff.
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-3 inline-block font-[family-name:var(--font-inter)] text-[12px] font-semibold text-zinc-900 underline underline-offset-4 transition-colors hover:text-zinc-500 dark:text-zinc-100 dark:hover:text-zinc-400"
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
              className="rounded-[2px] border-zinc-300/90 bg-white text-zinc-900 placeholder:text-zinc-400 focus-visible:border-zinc-500/50 focus-visible:ring-1 focus-visible:ring-zinc-500/25 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100 dark:placeholder:text-zinc-500"
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

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-[2px] border border-zinc-200/80 bg-zinc-100/30 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/20">
            <span className={TENANCY_LABEL}>Onboarding status</span>
            <p className="mt-1 font-[family-name:var(--font-inter)] text-[13px] font-medium capitalize text-zinc-900 dark:text-zinc-100">
              {onboardingStatus.replace(/_/g, " ")}
            </p>
          </div>
          <div className="rounded-[2px] border border-zinc-200/80 bg-zinc-100/30 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/20">
            <span className={TENANCY_LABEL}>Reference token</span>
            <p className="mt-1 break-all font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
              {referencingToken ?? "Not set (generated on first send)"}
            </p>
          </div>
          <div className="rounded-[2px] border border-zinc-200/80 bg-zinc-100/30 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/20">
            <span className={TENANCY_LABEL}>Last handoff sent</span>
            <p className="mt-1 font-[family-name:var(--font-inter)] text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
              {fmt(lastOutboundAt)}
            </p>
          </div>
          <div className="rounded-[2px] border border-zinc-200/80 bg-zinc-100/30 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/20">
            <span className={TENANCY_LABEL}>Last agency reply (inbound)</span>
            <p className="mt-1 font-[family-name:var(--font-inter)] text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
              {fmt(lastInboundAt)}
            </p>
          </div>
        </div>

        {handoffRecipientEmail ? (
          <div className="rounded-[2px] border border-zinc-200/80 bg-zinc-100/40 px-4 py-3 font-[family-name:var(--font-inter)] text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/25 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Handoff is emailed to </span>
            <span className="select-all break-all font-mono text-zinc-900 dark:text-zinc-100">{handoffRecipientEmail}</span>
            <span className="text-zinc-600 dark:text-zinc-400">
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
        <p className="font-[family-name:var(--font-inter)] text-[11px] font-light leading-relaxed text-zinc-500 dark:text-zinc-500">
          When you receive the agency&apos;s final outcome (e.g. pass / fail / guarantor required), use{" "}
          <strong className="font-medium text-zinc-900 dark:text-zinc-100">Mark referencing complete</strong> if Letora hasn&apos;t updated
          automatically from inbound email.
        </p>

        {events.length > 0 ? (
          <div className="border-t border-zinc-200/70 pt-6 dark:border-zinc-800">
            <p className={cn(TENANCY_LABEL, "mb-3")}>Recent activity</p>
            <ul className="space-y-2">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-[2px] border border-zinc-200/70 bg-zinc-100/35 px-4 py-3 transition-colors hover:bg-zinc-100/55 dark:border-zinc-800 dark:bg-zinc-900/20 dark:hover:bg-zinc-900/35"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-[family-name:var(--font-inter)] text-[13px] font-medium capitalize text-zinc-900 dark:text-zinc-100">
                      {ev.direction}
                    </span>
                    <span className="font-[family-name:var(--font-inter)] text-[10px] text-zinc-500">{fmt(ev.createdAt)}</span>
                  </div>
                  {ev.outcome ? (
                    <p className="mt-1 font-[family-name:var(--font-inter)] text-[11px] text-zinc-500 dark:text-zinc-500">
                      Outcome: {ev.outcome}
                    </p>
                  ) : null}
                  {ev.subject ? (
                    <p className="mt-1 font-[family-name:var(--font-inter)] text-[12px] text-zinc-900 dark:text-zinc-100">{ev.subject}</p>
                  ) : null}
                  {ev.bodyPreview ? (
                    <p className="mt-1 line-clamp-2 font-[family-name:var(--font-inter)] text-[11px] text-zinc-500 dark:text-zinc-500">
                      {ev.bodyPreview}
                    </p>
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
