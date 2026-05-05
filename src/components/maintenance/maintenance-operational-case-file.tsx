import Link from "next/link";
import type { ReactNode } from "react";

import type { MaintenanceDetail } from "@/lib/actions/maintenance";

import { AssignContractorForm } from "@/components/maintenance/assign-contractor-form";
import { MaintenanceRelatedEmailsTable } from "@/components/maintenance/related-emails-table";
import { ResolveMaintenanceForm } from "@/components/maintenance/resolve-maintenance-form";
import { cn } from "@/lib/utils";

function fmtDt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(status: string | null) {
  return (status ?? "").toLowerCase();
}

function statusLabel(status: string | null): string {
  const s = normalizeStatus(status);
  if (s === "resolved") return "Resolved";
  if (s === "in_progress") return "In progress";
  if (s === "scheduled") return "Scheduled";
  return "Pending";
}

function TriageChip({ category }: { category: string | null }) {
  if (!category?.trim()) {
    return (
      <span className="border border-[#333333] bg-[#0B0B0B] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
        Analysing…
      </span>
    );
  }
  const c = category.toLowerCase();
  if (c === "urgent-safety") {
    return (
      <span className="border border-red-900/50 bg-red-950/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ffb4ab]">
        urgent-safety
      </span>
    );
  }
  if (c === "urgent") {
    return (
      <span className="border border-amber-900/40 bg-amber-950/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
        urgent
      </span>
    );
  }
  if (c === "routine") {
    return (
      <span className="border border-[#333333] bg-[#141414] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
        routine
      </span>
    );
  }
  return (
    <span className="border border-[#333333] bg-[#141414] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300">
      {category || "triaged"}
    </span>
  );
}

function StatusStrip({ status }: { status: string | null }) {
  const s = normalizeStatus(status);
  const resolved = s === "resolved";
  return (
    <span
      className={cn(
        "border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
        resolved
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : s === "in_progress"
            ? "border-rose-500/25 bg-rose-950/30 text-[#ffb4ab]"
            : "border-[#333333] bg-[#141414] text-zinc-300",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 border border-[#333333] bg-[#161616]"
    >
      <header className="border-b border-[#282828] bg-[#161616] px-5 py-4 md:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p>
        <h3 className="mt-1 text-xs font-bold uppercase tracking-wider text-white">{title}</h3>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-zinc-500">{subtitle}</p>
        ) : null}
      </header>
      <div className="space-y-4 px-5 py-5 text-[12px] leading-relaxed text-zinc-300 md:px-6">
        {children}
      </div>
    </section>
  );
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="min-w-0 text-[13px] text-zinc-200">{value}</div>
    </div>
  );
}

/**
 * Operational case file UI for `/dashboard/maintenance/[id]` — aligns with Maintenance Center staging.
 */
export function MaintenanceOperationalCaseFile({ detail }: { detail: MaintenanceDetail }) {
  const titleLine = (() => {
    const line = detail.description?.split(/\n/)[0]?.trim();
    return line && line.length > 0 ? line.slice(0, 140) : "Maintenance request";
  })();

  const backHref = `/dashboard/maintenance?issueId=${encodeURIComponent(detail.id)}`;
  const st = normalizeStatus(detail.status);
  const canResolve = st === "open" || st === "in_progress" || !detail.status?.trim();

  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col bg-[#0B0B0B] font-['Inter',system-ui,sans-serif] text-[#e5e2e1]">
      {/* Back trail */}
      <div className="shrink-0 border-b border-[#282828] bg-[#141414] px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="size-1.5 shrink-0 bg-[#afefdd]" aria-hidden />
          <Link
            href={backHref}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#e5e2e1] underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            ← Maintenance Center
          </Link>
          <span className="hidden h-3 w-px bg-[#333333] sm:block" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600">
            Case file · ISSUE #{detail.id.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* Case header */}
      <header className="shrink-0 border-b border-[#282828] bg-[#0B0B0B] px-4 py-6 md:px-6 md:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Full case workspace
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">{titleLine}</h1>
            <p className="text-[13px] text-zinc-500">
              {detail.propertyAddress ?? "Property"} · {detail.tenantFullName ?? "Tenant"}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <StatusStrip status={detail.status} />
              {detail.propertyId ? (
                <Link
                  href={`/dashboard/properties/${detail.propertyId}`}
                  className="border border-[#333333] bg-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                >
                  Property record
                </Link>
              ) : null}
              {detail.tenantId ? (
                <Link
                  href={`/dashboard/tenants/${detail.tenantId}`}
                  className="border border-[#333333] bg-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                >
                  Tenant
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <Link
              href="/dashboard/approvals"
              className="border border-[#333333] px-4 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white sm:min-w-[12rem]"
            >
              Approvals queue
            </Link>
            {canResolve ? (
              <div className="sm:min-w-[12rem]">
                <ResolveMaintenanceForm requestId={detail.id} />
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* KPI strip — echoes Maintenance Center */}
      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-[#282828] bg-[#282828] md:grid-cols-4">
        {[
          { label: "Reported", value: fmtDt(detail.createdAt) },
          { label: "Priority", value: detail.priority ?? "—" },
          { label: "Contractor", value: detail.contractorName?.trim() || "—" },
          { label: "Last update", value: fmtDt(detail.updatedAt ?? detail.createdAt) },
        ].map((k) => (
          <div key={k.label} className="bg-[#0B0B0B] px-4 py-3 md:py-4">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{k.label}</p>
            <p className="text-[11px] font-semibold tabular-nums text-white">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:divide-x lg:divide-[#282828]">
        {/* Main dossier */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-24 md:p-6 md:pb-28 lg:border-r lg:border-[#282828]">
          <Section
            id="request-issue"
            eyebrow="Incident"
            title="Issue description"
          >
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
              {detail.description ?? "—"}
            </p>
          </Section>

          <Section
            eyebrow="Stakeholders"
            title="Parties & acknowledgements"
            subtitle="Operational context pulled from tenancy — use links above for dossier edits."
          >
            <div className="grid gap-4">
              <FieldRow label="Tenant" value={detail.tenantFullName ?? "—"} />
              <FieldRow label="Tenant email" value={detail.tenantEmail ?? "—"} />
              <FieldRow label="Tenant acknowledged" value={fmtDt(detail.tenantAcknowledgedAt)} />
              <FieldRow label="Landlord notified" value={fmtDt(detail.landlordNotifiedAt)} />
            </div>
          </Section>

          <Section
            eyebrow="AI triage"
            title="Triage summary"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Category:</span>
              <TriageChip category={detail.aiTriageCategory} />
            </div>
            <div className="space-y-3 border-t border-[#282828] pt-4">
              <FieldRow
                label="Summary"
                value={detail.aiTriageSummary ?? "No summary stored for this agent run yet."}
              />
              <FieldRow
                label="Response window"
                value={detail.triageFromRun?.responseTime ?? "—"}
              />
              <FieldRow
                label="Recommended move"
                value={detail.triageFromRun?.recommendedAction ?? "—"}
              />
            </div>
            {detail.maintenanceAgentRunId ? (
              <p className="border-t border-[#282828] pt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">
                Agent run · {detail.maintenanceAgentRunId.slice(0, 8)}
              </p>
            ) : null}
          </Section>

          <div id="assign-contractor">
            <AssignContractorForm
              requestId={detail.id}
              contractorName={detail.contractorName}
              contractorEmail={detail.contractorEmail}
              status={detail.status}
            />
          </div>

          <section className="border border-[#333333] bg-[#161616]">
            <header className="border-b border-[#282828] bg-[#161616] px-5 py-4 md:px-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Comms ledger</p>
              <h3 className="mt-1 text-xs font-bold uppercase tracking-wider text-white">Related outbound emails</h3>
              <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-zinc-500">
                Queued or sent correspondence tied to approved maintenance drafts — review or send drafts from
                Approvals.
              </p>
            </header>
            <div className="border-t border-[#282828]">
              <MaintenanceRelatedEmailsTable emailLogs={detail.emailLogs} />
            </div>
          </section>
        </div>

        {/* Timeline sidebar */}
        <aside className="shrink-0 border-t border-[#282828] bg-[#0B0B0B] lg:w-72 lg:border-t-0 lg:border-l lg:border-[#282828]">
          <div className="sticky top-0 space-y-0 border-[#282828] p-4 md:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Timeline</p>
            <h4 className="mt-3 text-[11px] font-bold uppercase tracking-wider text-white">Case milestones</h4>
            <ol className="relative mt-6 space-y-8 border-l border-[#282828] pl-6 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500">
              <li className="relative">
                <span className="absolute -left-[25px] top-1 size-2 rounded-full bg-white" aria-hidden />
                <p className="text-[11px] font-bold text-white">Reported</p>
                <p className="mt-1">{fmtDt(detail.createdAt)}</p>
              </li>
              {detail.updatedAt && detail.updatedAt !== detail.createdAt ? (
                <li className="relative">
                  <span className="absolute -left-[25px] top-1 size-2 rounded-full bg-zinc-600" aria-hidden />
                  <p className="text-[11px] font-bold text-zinc-200">Workspace update</p>
                  <p className="mt-1">{fmtDt(detail.updatedAt)}</p>
                </li>
              ) : null}
              {(detail.contractorName ?? "").trim() ? (
                <li className="relative">
                  <span className="absolute -left-[25px] top-1 size-2 rounded-full bg-blue-400" aria-hidden />
                  <p className="text-[11px] font-bold text-zinc-200">Contractor on file</p>
                  <p className="mt-2 text-[10px] normal-case lowercase text-zinc-400 first-letter:uppercase">
                    {(detail.contractorName ?? "").trim()}
                  </p>
                </li>
              ) : null}
              {["resolved", "completed"].includes(normalizeStatus(detail.status)) && detail.resolvedAt ? (
                <li className="relative">
                  <span className="absolute -left-[25px] top-1 size-2 rounded-full bg-emerald-400" aria-hidden />
                  <p className="text-[11px] font-bold text-emerald-400">Resolved</p>
                  <p className="mt-1">{fmtDt(detail.resolvedAt)}</p>
                </li>
              ) : null}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
