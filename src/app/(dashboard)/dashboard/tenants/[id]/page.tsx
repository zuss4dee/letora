import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CircleDollarSign,
  History,
  Key,
  ShieldCheck,
  User,
  Wrench,
} from "lucide-react";

import { BatchReviewReturnBanner } from "@/components/dashboard/batch-review-return-banner";
import { EditTenantDialog } from "@/components/tenants/edit-tenant-dialog";
import { getTenantProfileOperationalData } from "@/lib/actions/tenants";
import { parseSafeBatchReviewReturnFromSearchParams } from "@/lib/navigation/batch-review-return";
import { type UpdateTenantInput } from "@/lib/validations/tenant";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { TenantProfileKpiStrip } from "@/components/tenants/tenant-profile-kpi-strip";
import { TenantOperationalHistory } from "@/components/tenants/tenant-operational-history";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function formatShortUkDate(isoDate: string | null) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function toTenantFormInput(t: {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  rightToRentStatus: string | null;
}): UpdateTenantInput {
  const r = (t.rightToRentStatus ?? "pending").toLowerCase();
  const rt =
    r === "verified" || r === "failed" || r === "pending"
      ? (r as "verified" | "failed" | "pending")
      : "pending";
  return {
    fullName: t.fullName ?? "",
    email: t.email ?? "",
    phone: t.phone ?? "",
    dateOfBirth: t.dateOfBirth ?? "",
    rightToRentStatus: rt,
  };
}

function TenantDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-100 dark:bg-[#0B0B0B]">
      <div className="h-20 border-b border-zinc-200/80 bg-white dark:border-[#232323] dark:bg-zinc-900" />
      <div className="h-16 border-b border-zinc-200/80 bg-zinc-100 dark:border-[#232323] dark:bg-[#0B0B0B]" />
      <div className="flex-1 p-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 h-64 animate-pulse rounded-md bg-zinc-200/80 dark:bg-[#161616] lg:col-span-8" />
          <div className="col-span-12 h-64 animate-pulse rounded-md bg-zinc-200/80 dark:bg-[#161616] lg:col-span-4" />
        </div>
      </div>
    </div>
  );
}

async function TenantDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  if (!userId) {
    return notFound();
  }

  const data = await getTenantProfileOperationalData(userId, id);
  if (!data) {
    return notFound();
  }

  const { tenant, activeTenancy, rent, maintenance, approvals, activity } = data;

  const lastPaidOnLabel = rent.lastPaid ? formatShortUkDate(rent.lastPaid.dateIso) : null;
  const lastPaidSummary =
    rent.lastPaid == null
      ? null
      : `${rent.lastPaid.amountGbp > 0 ? formatCurrency(rent.lastPaid.amountGbp) : "—"}${
          lastPaidOnLabel ? ` · ${lastPaidOnLabel}` : ""
        }`;

  return (
    <div className="flex flex-1 flex-col bg-zinc-100 dark:bg-[#0B0B0B]">
      {/* CASE HEADER */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white px-6 py-5 dark:border-[#232323] dark:bg-[#0e0e0e]">
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard/tenants"
            className="group flex h-8 w-8 items-center justify-center border border-zinc-200/80 transition-colors hover:border-zinc-400 dark:border-[#232323] dark:hover:border-zinc-500"
          >
            <ArrowLeft className="size-4 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[18px] font-bold tracking-tight text-zinc-900 uppercase dark:text-white">
                {tenant.fullName}
              </h1>
              {tenant.rightToRentStatus === "verified" && (
                <ShieldCheck className="size-4 text-emerald-500" />
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span>{tenant.email}</span>
              <span className="text-zinc-400 dark:text-zinc-700">•</span>
              <span>{tenant.phone}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <EditTenantDialog tenantId={tenant.id} initial={toTenantFormInput(tenant)} />
        </div>
      </header>

      {/* OPERATIONAL KPI STRIP */}
      <TenantProfileKpiStrip
        stats={{
          status: activeTenancy?.status ?? "Inactive",
          monthlyRent: rent.monthlyRentGbp,
          arrears: rent.arrearsGbp,
          openMaintenance: maintenance.openCount,
          pendingApprovals: approvals.pendingCount,
        }}
      />

      {/* MAIN CASE CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: CONTEXT & FINANCES */}
          <div className="col-span-12 space-y-6 lg:col-span-8">
            
            {/* ACTIVE TENANCY CONTEXT */}
            <section className="border border-zinc-200/80 bg-white dark:border-[#232323] dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-3 dark:border-[#232323]">
                <div className="flex items-center gap-2">
                  <Key className="size-3.5 text-zinc-500" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Active Tenancy Context
                  </h3>
                </div>
                {activeTenancy && (
                  <Link
                    href={`/dashboard/tenancies/${activeTenancy.id}`}
                    className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400"
                  >
                    Manage Tenancy
                  </Link>
                )}
              </div>
              
              <div className="p-5">
                {activeTenancy ? (
                  <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    <div>
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-600">Property</p>
                      <Link href={`/dashboard/properties/${activeTenancy.propertyId}`} className="text-[12px] font-bold text-zinc-900 underline-offset-4 hover:text-zinc-700 hover:underline dark:text-zinc-200 dark:hover:text-white">
                        {activeTenancy.propertyAddress}
                      </Link>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-600">Start Date</p>
                      <p className="text-[12px] font-bold text-zinc-800 dark:text-zinc-200">{activeTenancy.startDate ?? "—"}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-600">End Date</p>
                      <p className="text-[12px] font-bold text-zinc-800 dark:text-zinc-200">{activeTenancy.endDate ?? "Rolling"}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-600">Monthly Rent</p>
                      <p className="text-[12px] font-bold text-zinc-900 dark:text-white">
                        {activeTenancy.monthlyRent != null ? formatCurrency(activeTenancy.monthlyRent) : "—"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-widest dark:text-zinc-600">No active tenancy found</p>
                  </div>
                )}
              </div>
            </section>

            {/* RENT & ARREARS HUB */}
            <section className="border border-zinc-200/80 bg-white dark:border-[#232323] dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-3 dark:border-[#232323]">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="size-3.5 text-zinc-500" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Financial Health & Arrears
                  </h3>
                </div>
                <Link
                  href={`/dashboard/rent-tracker?tenantId=${tenant.id}`}
                  className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                >
                  Full Rent History
                </Link>
              </div>
              
              <div className="grid grid-cols-1 divide-zinc-200/80 md:grid-cols-2 md:divide-x dark:divide-[#232323]">
                <div className="p-6">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Current Balance</p>
                  <p
                    className={cn(
                      "text-[32px] font-bold tabular-nums tracking-tighter",
                      rent.status === "overdue" ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    {formatCurrency(rent.arrearsGbp)}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {rent.status === "overdue"
                      ? "Requires immediate collection action"
                      : rent.status === "pending"
                        ? "Check Rent Tracker for due or upcoming instalments."
                        : "Account is currently in good standing"}
                  </p>
                </div>
                <div className="bg-zinc-50 p-6 flex flex-col justify-center dark:bg-[#0B0B0B]">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">Last Payment</span>
                      <span className="text-right text-[11px] font-bold text-zinc-800 dark:text-zinc-300">
                        {lastPaidSummary != null ? lastPaidSummary : (
                          <span className="font-medium text-zinc-500 dark:text-zinc-600">No data</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">Payment Status</span>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 border",
                          rent.status === "overdue" &&
                            "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:text-rose-500 dark:bg-rose-500/5",
                          rent.status === "pending" &&
                            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:text-amber-500 dark:bg-amber-500/5",
                          rent.status === "paid" &&
                            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:text-emerald-500 dark:bg-emerald-500/5"
                        )}
                      >
                        {rent.status === "overdue"
                          ? "OVERDUE"
                          : rent.status === "pending"
                            ? "PENDING"
                            : "PAID"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* MAINTENANCE OVERVIEW */}
            <section className="border border-zinc-200/80 bg-white dark:border-[#232323] dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-3 dark:border-[#232323]">
                <div className="flex items-center gap-2">
                  <Wrench className="size-3.5 text-zinc-500" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Maintenance Participation
                  </h3>
                </div>
                <Link
                  href={`/dashboard/maintenance?tenantId=${tenant.id}`}
                  className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                >
                  View All Issues
                </Link>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between rounded-md border border-zinc-200/80 bg-zinc-50 p-4 dark:border-[#232323] dark:bg-[#0B0B0B]">
                  <div>
                    <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                      {maintenance.openCount} Open Maintenance {maintenance.openCount === 1 ? "Issue" : "Issues"}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Ongoing operational tickets requiring coordination with this tenant.
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/maintenance?tenantId=${tenant.id}`}
                    className="flex h-8 w-8 items-center justify-center border border-zinc-200/80 transition-colors hover:border-zinc-400 dark:border-[#232323] dark:hover:border-zinc-600"
                  >
                    <ArrowRight className="size-3.5 text-zinc-500" />
                  </Link>
                </div>
              </div>
            </section>

          </div>

          {/* RIGHT COLUMN: OPERATIONAL HISTORY & IDENTITY */}
          <div className="col-span-12 space-y-6 lg:col-span-4">
            
            {/* IDENTITY METADATA */}
            <section className="border border-zinc-200/80 bg-white dark:border-[#232323] dark:bg-zinc-900">
              <div className="flex items-center gap-2 border-b border-zinc-200/80 px-5 py-3 dark:border-[#232323]">
                <User className="size-3.5 text-zinc-500" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  Identity Metadata
                </h3>
              </div>
              <div className="space-y-5 p-5">
                <div>
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-600">Date of Birth</p>
                  <p className="text-[12px] font-bold text-zinc-800 dark:text-zinc-300">{tenant.dateOfBirth ?? "—"}</p>
                </div>
                <div>
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-600">Right to Rent</p>
                  <p className={cn(
                    "text-[10px] font-bold uppercase",
                    tenant.rightToRentStatus === "verified" ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500"
                  )}>
                    {tenant.rightToRentStatus ?? "PENDING"}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-600">System Reference</p>
                  <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-600">{tenant.id}</p>
                </div>
              </div>
            </section>

            {/* OPERATIONAL HISTORY LOG */}
            <section className="border border-zinc-200/80 bg-white dark:border-[#232323] dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-3 dark:border-[#232323]">
                <div className="flex items-center gap-2">
                  <History className="size-3.5 text-zinc-500" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Operational History
                  </h3>
                </div>
                <Link
                  href="/dashboard/activity"
                  className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-400"
                >
                  Full Log
                </Link>
              </div>
              <div className="p-6">
                <TenantOperationalHistory activity={activity} />
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const batchReviewReturnHref = parseSafeBatchReviewReturnFromSearchParams(sp);

  return (
    <div className="@container/main relative flex min-h-[calc(100vh-2.5rem)] flex-1 flex-col bg-background dark:bg-[#f8f8f7] text-zinc-950 dark:bg-[#0B0B0B] dark:text-zinc-100">
      {batchReviewReturnHref ? <BatchReviewReturnBanner href={batchReviewReturnHref} /> : null}
      <Suspense fallback={<TenantDetailSkeleton />}>
        <TenantDetailContent params={params} />
      </Suspense>
    </div>
  );
}
