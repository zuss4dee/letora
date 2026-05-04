export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";

import { MaintenanceWorkspaceClient } from "@/components/maintenance/maintenance-workspace-client";
import { PropertyPortfolioBackLink } from "@/components/dashboard/property-portfolio-back-link";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import type { MaintenanceDetail, MaintenanceRequestRow } from "@/lib/actions/maintenance";
import { getMaintenanceRequestDetail, getMaintenanceRequests } from "@/lib/actions/maintenance";
import { getPendingApprovalsForMaintenance } from "@/lib/actions/agent-approvals";
import { createClient } from "@/lib/supabase/server";

function detailToListRow(d: MaintenanceDetail): MaintenanceRequestRow {
  return {
    id: d.id,
    tenancyId: d.tenancyId,
    propertyId: d.propertyId,
    propertyAddress: d.propertyAddress,
    tenantId: d.tenantId,
    tenantFullName: d.tenantFullName,
    description: d.description,
    priority: d.priority,
    status: d.status,
    createdAt: d.createdAt,
    resolvedAt: d.resolvedAt,
    contractorName: d.contractorName,
    contractorEmail: d.contractorEmail,
    aiTriageCategory: d.aiTriageCategory,
    aiTriageSummary: d.aiTriageSummary,
  };
}

async function MaintenanceWorkspaceSection({
  propertyId,
  focusIssueId,
}: {
  propertyId?: string;
  focusIssueId?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const [requests, pendingApprovals] = await Promise.all([
    userId ? getMaintenanceRequests(userId) : { open: [], resolved: [] },
    getPendingApprovalsForMaintenance(),
  ]);

  const matchesProperty = (row: MaintenanceRequestRow) =>
    propertyId == null || row.propertyId === propertyId;

  const openFiltered = requests.open.filter(matchesProperty);
  const resolvedFiltered = requests.resolved.filter(matchesProperty);

  const openSorted = [...openFiltered].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const combined = [...openSorted, ...resolvedFiltered];

  const focus = focusIssueId?.trim();
  let focalRow: MaintenanceRequestRow | null = null;
  if (userId && focus) {
    const existing = combined.find((r) => r.id === focus);
    if (existing) {
      focalRow = existing;
    } else {
      const detail = await getMaintenanceRequestDetail(userId, focus);
      if (detail) {
        if (propertyId == null || detail.propertyId === propertyId) {
          focalRow = detailToListRow(detail);
        }
      }
    }
  }

  const withoutFocal = focus ? combined.filter((r) => r.id !== focus) : combined;
  const rows = focalRow ? [focalRow, ...withoutFocal.slice(0, 19)] : combined.slice(0, 20);
  const activeCount = openFiltered.length;

  const resolvedDeeplinkId =
    focus != null && focus.length > 0 && rows.some((r) => r.id === focus) ? focus : undefined;
  const issueDeeplinkMissing = Boolean(focus && resolvedDeeplinkId == null);

  return (
    <MaintenanceWorkspaceClient
      rows={rows}
      activeCount={activeCount}
      pendingApprovals={pendingApprovals}
      deeplinkIssueId={resolvedDeeplinkId}
      issueDeeplinkMissing={issueDeeplinkMissing}
    />
  );
}

function MaintenanceWorkspaceFallback() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="h-10 shrink-0 border-b border-[#282828] bg-[#0B0B0B] px-4" />
      <main className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col bg-[#1A1A1A]">
          <div className="h-16 shrink-0 border-b border-[#282828] p-4" />
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-[2px] bg-[#242424]" />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; issueId?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.propertyId;
  const propertyId =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
  const rawIssue = sp.issueId;
  const focusIssueId =
    typeof rawIssue === "string" && rawIssue.trim().length > 0 ? rawIssue.trim() : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DashboardPollRefresh />
      {focusIssueId ? (
        <div className="shrink-0 border-b border-[#282828] bg-[#141414] px-4 py-2.5 font-['Inter',system-ui,sans-serif] md:px-6">
          <Link
            href="/dashboard"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#e5e2e1] underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            ← Command Center
          </Link>
          <span className="ml-4 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600">
            Maintenance / triage context
          </span>
        </div>
      ) : null}
      {propertyId ? (
        <div className="shrink-0 border-b border-[#282828] bg-[#0B0B0B] px-4 py-2">
          <Suspense fallback={<div className="h-4 w-44 animate-pulse rounded bg-[#242424]" />}>
            <PropertyPortfolioBackLink propertyId={propertyId} />
          </Suspense>
        </div>
      ) : null}
      <Suspense fallback={<MaintenanceWorkspaceFallback />}>
        <MaintenanceWorkspaceSection propertyId={propertyId} focusIssueId={focusIssueId} />
      </Suspense>
    </div>
  );
}
