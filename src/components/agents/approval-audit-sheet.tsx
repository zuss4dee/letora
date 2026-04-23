"use client";

import { useState, type ReactNode } from "react";

import {
  formatApprovalAbsoluteTime,
  formatApprovalActionType,
  formatApprovalAgentType,
  formatApprovalDecisionStatus,
  formatApprovalTargetLine,
} from "@/components/dashboard/approval-display";
import { parseStaleReminderAudit, STALE_REMINDER_EVIDENCE_KEY } from "@/lib/approvals/stale-approval-reminders";
import { MVP_TERMS } from "@/components/dashboard/workspace-terminology";
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

export function ApprovalAuditSheetBody({ approval }: { approval: AgentApprovalRow }) {
  const ev = (approval.evidence ?? {}) as Record<string, unknown>;
  const payload = (approval.payload ?? {}) as Record<string, unknown>;
  const reminder = parseStaleReminderAudit(ev);
  const targetLine = formatApprovalTargetLine(approval.target_type, approval.target_id);
  const correlation =
    typeof ev.run_correlation_id === "string" && ev.run_correlation_id.trim()
      ? ev.run_correlation_id.trim()
      : null;

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
        {sectionTitle("Lifecycle")}
        <dl className="space-y-2.5">
          <AuditRow label="Status">
            <span className="font-medium">{formatApprovalDecisionStatus(approval.status)}</span>
          </AuditRow>
          <AuditRow label="Action">{formatApprovalActionType(approval.action_type)}</AuditRow>
          <AuditRow label="Created">{formatApprovalAbsoluteTime(approval.created_at)}</AuditRow>
          <AuditRow label="Decided">
            {approval.decided_at ? formatApprovalAbsoluteTime(approval.decided_at) : "—"}
          </AuditRow>
          <AuditRow label="Completed at">
            {approval.executed_at ? formatApprovalAbsoluteTime(approval.executed_at) : "—"}
          </AuditRow>
          {approval.status === "denied" && approval.deny_reason?.trim() ? (
            <AuditRow label="Deny reason">{approval.deny_reason.trim()}</AuditRow>
          ) : null}
        </dl>
      </div>

      <div className="space-y-2">
        {sectionTitle("Agent & target")}
        <dl className="space-y-2.5">
          <AuditRow label="Agent type">{formatApprovalAgentType(approval.agent_type)}</AuditRow>
          <AuditRow label="Target">{targetLine ?? "—"}</AuditRow>
        </dl>
      </div>

      <div className="space-y-2">
        {sectionTitle("Review context")}
        <ContextForAction actionType={approval.action_type} evidence={ev} payload={payload} />
      </div>

      {reminder ? (
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/15 px-3 py-3 dark:border-white/[0.06]">
          {sectionTitle("Reminder audit")}
          <dl className="space-y-2">
            <AuditRow label="Channel">Operator email</AuditRow>
            <AuditRow label={`Last ${MVP_TERMS.sent.toLowerCase()}`}>{formatApprovalAbsoluteTime(reminder.last_sent_at)}</AuditRow>
            <AuditRow label={`${MVP_TERMS.reminded} count`}>{String(reminder.send_count)}</AuditRow>
          </dl>
        </div>
      ) : approval.status === "pending" ? (
        <p className="font-[family-name:var(--font-inter)] text-[0.7rem] text-muted-foreground">
          Not {MVP_TERMS.reminded.toLowerCase()} yet (operator nudge only when an item is {MVP_TERMS.aging.toLowerCase()}{" "}
          in queue).
        </p>
      ) : null}

      <details className="group rounded-lg border border-border/60 bg-card/30 dark:border-white/[0.06]">
        <summary className="cursor-pointer list-none px-3 py-2.5 font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="underline-offset-4 group-open:underline">Technical details</span>
        </summary>
        <div className="space-y-3 border-t border-border/50 px-3 py-3 dark:border-white/[0.06]">
          <dl className="space-y-2">
            <AuditRow label="Approval ID">{approval.id}</AuditRow>
            <AuditRow label="Agent run">{approval.agent_run_id ?? "—"}</AuditRow>
            <AuditRow label="Decided by (user id)">{approval.decided_by ?? "—"}</AuditRow>
            <AuditRow label="Target id (full)">{approval.target_id ?? "—"}</AuditRow>
            {correlation ? <AuditRow label="Correlation">{correlation}</AuditRow> : null}
          </dl>
          <div className="space-y-1">
            <p className="font-[family-name:var(--font-inter)] text-[0.6rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Raw payload
            </p>
            <pre className="max-h-40 overflow-auto rounded-md border border-border/50 bg-muted/25 p-2 font-mono text-[0.62rem] leading-relaxed text-foreground/80 dark:border-white/[0.06]">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
          <div className="space-y-1">
            <p className="font-[family-name:var(--font-inter)] text-[0.6rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Raw evidence (includes reminder metadata)
            </p>
            <pre className="max-h-40 overflow-auto rounded-md border border-border/50 bg-muted/25 p-2 font-mono text-[0.62rem] leading-relaxed text-foreground/80 dark:border-white/[0.06]">
              {JSON.stringify(ev, null, 2)}
            </pre>
          </div>
        </div>
      </details>
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
        overlayClassName="bg-black/20 dark:bg-black/40"
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
