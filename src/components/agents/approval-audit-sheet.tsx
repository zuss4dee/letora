"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { getEmailLogSnapshotForUser, type EmailLogSnapshot } from "@/lib/actions/email-drafts";
import {
  formatApprovalAbsoluteTime,
  formatApprovalActionType,
} from "@/components/dashboard/approval-display";
import { STALE_REMINDER_EVIDENCE_KEY } from "@/lib/approvals/stale-approval-reminders";
import type { AgentApprovalActionType, AgentApprovalRow } from "@/lib/approvals/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function sectionTitle(text: string) {
  return (
    <h3 className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
      {text}
    </h3>
  );
}

function AuditRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:gap-3">
      <dt className="font-[family-name:var(--font-inter)] text-[0.65rem] font-medium text-muted-foreground">{label}</dt>
      <dd className="font-[family-name:var(--font-inter)] text-[0.75rem] leading-snug text-foreground/90">{children}</dd>
    </div>
  );
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

function evidenceWithoutReminder(ev: Record<string, unknown>): Record<string, unknown> {
  const { [STALE_REMINDER_EVIDENCE_KEY]: _r, ...rest } = ev;
  return rest;
}

function previewBlock(text: string | null, maxHeightClass = "max-h-36") {
  if (!text?.trim()) return <span className="text-muted-foreground">—</span>;
  return (
    <p
      className={cn(
        "whitespace-pre-wrap break-words rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 font-[family-name:var(--font-inter)] text-[0.7rem] leading-relaxed text-foreground/85 dark:border-white/[0.06]",
        maxHeightClass,
        "overflow-y-auto",
      )}
    >
      {text.trim()}
    </p>
  );
}

function ContextForAction({
  actionType,
  evidence,
  payload,
}: {
  actionType: AgentApprovalActionType;
  evidence: Record<string, unknown>;
  payload: Record<string, unknown>;
}) {
  const ev = evidenceWithoutReminder(evidence);

  switch (actionType) {
    case "send_onboarding_email":
      return (
        <dl className="space-y-2.5">
          <AuditRow label="Tenant">{str(ev.tenantName) ?? "—"}</AuditRow>
          <AuditRow label="Email">{str(ev.tenantEmail) ?? "—"}</AuditRow>
          <AuditRow label="Property">{str(ev.propertyAddress) ?? "—"}</AuditRow>
          <AuditRow label="Subject">{str(ev.subject) ?? "—"}</AuditRow>
          {str((payload as { tenancyId?: string }).tenancyId) ? (
            <AuditRow label="Tenancy ID">{str((payload as { tenancyId?: string }).tenancyId)}</AuditRow>
          ) : null}
          {str((payload as { emailLogId?: string }).emailLogId) ? (
            <AuditRow label="Draft / log ID">{str((payload as { emailLogId?: string }).emailLogId)}</AuditRow>
          ) : null}
        </dl>
      );
    case "send_move_in_email":
      return (
        <dl className="space-y-2.5">
          <AuditRow label="Tenant">{str(ev.tenantName) ?? "—"}</AuditRow>
          <AuditRow label="Email">{str(ev.tenantEmail) ?? "—"}</AuditRow>
          <AuditRow label="Property">{str(ev.propertyAddress) ?? "—"}</AuditRow>
          <AuditRow label="Move-in date">{str(ev.moveInDate) ?? "—"}</AuditRow>
          <AuditRow label="Subject">{str(ev.subject) ?? "—"}</AuditRow>
          <AuditRow label="Body preview">{previewBlock(str(ev.bodyPreview))}</AuditRow>
          {str(payload.tenancyId) ? <AuditRow label="Tenancy ID">{str(payload.tenancyId)}</AuditRow> : null}
        </dl>
      );
    case "send_rent_chase_email": {
      const owed = num(ev.amountOwed);
      const days = num(ev.daysOverdue);
      return (
        <dl className="space-y-2.5">
          <AuditRow label="Tenant">{str(ev.tenantName) ?? "—"}</AuditRow>
          <AuditRow label="Property">{str(ev.propertyAddress) ?? "—"}</AuditRow>
          <AuditRow label="Amount owed">{owed != null ? formatGbp(owed) : "—"}</AuditRow>
          <AuditRow label="Days overdue">{days != null ? String(days) : "—"}</AuditRow>
          <AuditRow label="Due date">
            {str(ev.dueDate) ? formatApprovalAbsoluteTime(ev.dueDate as string) : "—"}
          </AuditRow>
          <AuditRow label="Subject">{str(ev.emailSubject) ?? "—"}</AuditRow>
          <AuditRow label="Body preview">{previewBlock(str(ev.bodyPreview))}</AuditRow>
          {str(payload.tenantEmail) ? <AuditRow label="To (payload)">{str(payload.tenantEmail)}</AuditRow> : null}
          {str(payload.rentPaymentId) ? <AuditRow label="Rent payment ID">{str(payload.rentPaymentId)}</AuditRow> : null}
        </dl>
      );
    }
    case "approve_maintenance_dispatch":
      return (
        <dl className="space-y-2.5">
          <AuditRow label="Request ID">{str(ev.maintenanceRequestId) ?? "—"}</AuditRow>
          <AuditRow label="Property">{str(ev.propertyAddress) ?? "—"}</AuditRow>
          <AuditRow label="Tenant">{str(ev.tenantName) ?? "—"}</AuditRow>
          <AuditRow label="Category / priority">
            {[str(ev.category), str(ev.priority)].filter(Boolean).join(" · ") || "—"}
          </AuditRow>
          <AuditRow label="Contractor">
            {[str(ev.contractorName), str(ev.contractorEmail)].filter(Boolean).join(" · ") || "—"}
          </AuditRow>
          <AuditRow label="Subject">{str(ev.emailSubject) ?? "—"}</AuditRow>
          <AuditRow label="Dispatch preview">{previewBlock(str(ev.dispatchPreview))}</AuditRow>
        </dl>
      );
    default:
      return <FallbackContext ev={ev} payload={payload} />;
  }
}

function FallbackContext({ ev, payload }: { ev: Record<string, unknown>; payload: Record<string, unknown> }) {
  const rows: { label: string; value: string }[] = [];
  for (const [k, v] of Object.entries(ev)) {
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      rows.push({ label: humanizeKey(k), value: String(v) });
    }
  }
  if (rows.length === 0 && Object.keys(payload).length === 0) {
    return <p className="font-[family-name:var(--font-inter)] text-[0.75rem] text-muted-foreground">No extra context stored.</p>;
  }
  return (
    <dl className="space-y-2.5">
      {rows.map((r) => (
        <AuditRow key={r.label} label={r.label}>
          {r.value}
        </AuditRow>
      ))}
      {Object.keys(payload).length > 0 ? (
        <AuditRow label="Payload (summary)">
          {Object.entries(payload)
            .filter(([, v]) => typeof v === "string" || typeof v === "number")
            .map(([k, v]) => `${humanizeKey(k)}: ${String(v)}`)
            .join(" · ") || "—"}
        </AuditRow>
      ) : null}
    </dl>
  );
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function shortId(id: string | null | undefined): string {
  if (!id?.trim()) return "—";
  return id.length <= 12 ? id : `${id.slice(0, 8)}…`;
}

function readEmailLogId(payload: Record<string, unknown>): string | null {
  for (const key of ["emailLogId", "email_log_id"] as const) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function emailIntroLine(actionType: AgentApprovalActionType): string {
  switch (actionType) {
    case "send_onboarding_email":
    case "send_move_in_email":
      return "Message the AI proposes to send to the tenant (review before approving).";
    case "send_rent_chase_email":
      return "Rent reminder the AI proposes to email to the tenant.";
    case "approve_maintenance_dispatch":
      return "Email draft to the contractor (tenant notices are separate).";
    default:
      return "Outbound email associated with this approval.";
  }
}

function ApprovalEmailAuditSection({ approval }: { approval: AgentApprovalRow }) {
  const payload = (approval.payload ?? {}) as Record<string, unknown>;
  const ev = (approval.evidence ?? {}) as Record<string, unknown>;
  const logId = readEmailLogId(payload);
  const [snapshot, setSnapshot] = useState<EmailLogSnapshot | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);

  useEffect(() => {
    if (!logId) {
      setSnapshot(null);
      setSnapLoading(false);
      return;
    }
    let cancelled = false;
    setSnapLoading(true);
    void getEmailLogSnapshotForUser(logId).then((s) => {
      if (!cancelled) {
        setSnapshot(s);
        setSnapLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [logId]);

  const subject =
    str(payload.emailSubject) ??
    str(payload.email_subject) ??
    str(ev.subject) ??
    str(ev.emailSubject) ??
    snapshot?.subject ??
    null;

  const body =
    str(payload.emailBody) ??
    str(payload.email_body) ??
    str(ev.bodyPreview) ??
    str(ev.dispatchPreview) ??
    snapshot?.body ??
    null;

  const hasCopy = Boolean(subject?.trim() || body?.trim());
  const hubHref = logId ? `/dashboard/emails?logId=${encodeURIComponent(logId)}` : "/dashboard/emails";

  return (
    <div className="space-y-2">
      {sectionTitle("Email message")}
      <p className="font-[family-name:var(--font-inter)] text-[0.72rem] leading-relaxed text-muted-foreground">
        {emailIntroLine(approval.action_type)}
      </p>
      {logId ? (
        <p className="font-[family-name:var(--font-inter)] text-[0.68rem] text-muted-foreground">
          Workflow log ID:{" "}
          <span className="font-mono text-foreground/80" title={logId}>
            {shortId(logId)}
          </span>
          {snapshot?.status ? (
            <span className="ml-2 rounded-sm border border-border/60 px-1.5 py-0.5 text-[0.62rem] uppercase tracking-wide text-muted-foreground dark:border-white/[0.08]">
              {snapshot.status}
            </span>
          ) : null}
        </p>
      ) : null}
      {hasCopy ? (
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-3 dark:border-white/[0.06]">
          <AuditRow label="Subject">{subject?.trim() ? subject : "—"}</AuditRow>
          <div>
            <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-medium text-muted-foreground">
              Body
            </p>
            {previewBlock(body, "max-h-64")}
          </div>
        </div>
      ) : (
        <p className="font-[family-name:var(--font-inter)] text-[0.72rem] text-muted-foreground">
          {logId && snapLoading
            ? "Loading message from Communications…"
            : logId
              ? "No body text on file for this log — open Communications to inspect the row."
              : "No full copy stored on this approval yet. Check Review context above for metadata."}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-[family-name:var(--font-inter)] text-[0.62rem] uppercase tracking-[0.1em]"
          asChild
        >
          <Link href={hubHref}>
            {logId ? "Open in Communications" : "View all emails & drafts"}
          </Link>
        </Button>
        {logId && snapshot?.status === "draft" ? (
          <p className="w-full font-[family-name:var(--font-inter)] text-[0.65rem] text-amber-600/90 dark:text-amber-400/90">
            This row is still a draft in Communications until you send it from there or complete the approval flow.
          </p>
        ) : null}
        {logId && snapshot?.status === "sent" ? (
          <p className="w-full font-[family-name:var(--font-inter)] text-[0.65rem] text-emerald-600/90 dark:text-emerald-400/90">
            Logged as sent — Communications hub lists tenant-facing delivery with the rest of your mail.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ApprovalAuditSheetBody({ approval }: { approval: AgentApprovalRow }) {
  const ev = (approval.evidence ?? {}) as Record<string, unknown>;
  const payload = (approval.payload ?? {}) as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-2">
      <div className="space-y-2">
        {sectionTitle("Summary")}
        <p className="font-[family-name:var(--font-inter)] text-[0.8125rem] leading-snug text-foreground">{approval.title}</p>
        {approval.summary ? (
          <p className="font-[family-name:var(--font-inter)] text-[0.75rem] leading-relaxed text-muted-foreground">
            {approval.summary}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        {sectionTitle("Review context")}
        <ContextForAction actionType={approval.action_type} evidence={ev} payload={payload} />
      </div>

      <ApprovalEmailAuditSection approval={approval} />
    </div>
  );
}

export function ApprovalAuditSheetTrigger({
  approval,
  className,
  label = "Audit",
}: {
  approval: AgentApprovalRow;
  className?: string;
  /** Button label (keep short). */
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "font-[family-name:var(--font-inter)] text-[0.62rem] uppercase tracking-[0.1em]",
            className,
          )}
        >
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton
        className="flex w-full flex-col gap-0 overflow-y-auto border-border/80 p-0 sm:max-w-lg dark:border-white/[0.08]"
        overlayClassName="bg-zinc-950 dark:bg-black/20 dark:bg-black/40"
      >
        <SheetHeader className="border-b border-border/60 px-4 pb-4 pt-4 text-left dark:border-white/[0.06]">
          <SheetTitle className="font-headline text-base font-light tracking-tight text-foreground pr-8">
            Approval audit
          </SheetTitle>
          <SheetDescription className="font-[family-name:var(--font-inter)] text-[0.75rem] text-muted-foreground">
            {formatApprovalActionType(approval.action_type)} · {shortId(approval.id)}
          </SheetDescription>
        </SheetHeader>
        <ApprovalAuditSheetBody approval={approval} />
      </SheetContent>
    </Sheet>
  );
}
