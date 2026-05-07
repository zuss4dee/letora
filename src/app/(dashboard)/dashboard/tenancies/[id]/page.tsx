export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BatchReviewReturnBanner } from "@/components/dashboard/batch-review-return-banner";
import { EditTenancyDialog } from "@/components/tenancies/edit-tenancy-dialog";
import { ReferencingPanel } from "@/components/tenancies/referencing-panel";
import { TenancyOnboardingPanel } from "@/components/tenancies/tenancy-onboarding-panel";
import { TENANCY_LABEL } from "@/components/tenancies/tenancy-letora-surfaces";
import { getReferencingEvents } from "@/lib/actions/referencing";
import { getTenancyOnboardingDetail } from "@/lib/actions/onboarding";
import { parseSafeBatchReviewReturnFromSearchParams } from "@/lib/navigation/batch-review-return";
import { createClient } from "@/lib/supabase/server";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default async function TenancyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const batchReviewReturnHref = parseSafeBatchReviewReturnFromSearchParams(sp);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const detail = await getTenancyOnboardingDetail(id);
  if (!detail) return notFound();

  const { data: tenancy } = await supabase
    .from("tenancies")
    .select("start_date, end_date, move_in_date, monthly_rent, deposit_amount, status")
    .eq("id", id)
    .maybeSingle();

  const monthlyRent =
    tenancy?.monthly_rent == null
      ? null
      : typeof tenancy.monthly_rent === "number"
        ? tenancy.monthly_rent
        : Number(tenancy.monthly_rent);
  const deposit =
    tenancy?.deposit_amount == null
      ? null
      : typeof tenancy.deposit_amount === "number"
        ? tenancy.deposit_amount
        : Number(tenancy.deposit_amount);
  const startDate = tenancy?.start_date ?? detail.start_date ?? null;
  const endDate = tenancy?.end_date ?? null;
  const moveInDate = tenancy?.move_in_date ?? null;
  const tenancyStatus = tenancy?.status ?? null;

  const userId = user?.id ?? null;
  const referencingEvents = userId ? await getReferencingEvents(userId, id) : [];

  let hasDefaultReferencingAgencyEmail = false;
  let defaultReferencingAgencyEmail: string | null = null;
  if (userId) {
    const { data: refSettings } = await supabase
      .from("user_settings")
      .select("referencing_agency_email")
      .eq("user_id", userId)
      .maybeSingle();
    defaultReferencingAgencyEmail =
      (refSettings?.referencing_agency_email as string | null)?.trim() || null;
    hasDefaultReferencingAgencyEmail = Boolean(defaultReferencingAgencyEmail);
  }

  return (
    <div className="@container/main relative flex min-h-[calc(100vh-2.5rem)] flex-1 flex-col bg-[#f8f8f7] text-zinc-950 dark:bg-[#0B0B0B] dark:text-zinc-100">
      {batchReviewReturnHref ? <BatchReviewReturnBanner href={batchReviewReturnHref} /> : null}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-y border-zinc-200/70 bg-[#161616] dark:border-zinc-800 dark:bg-[#1A1A1A]">
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[min(38vh,360px)] bg-[radial-gradient(ellipse_70%_60%_at_50%_-8%,rgba(255,255,255,0.04),transparent_62%)] dark:bg-[radial-gradient(ellipse_70%_60%_at_50%_-8%,rgba(255,255,255,0.04),transparent_62%)]"
            aria-hidden
          />
          <div className="relative flex min-h-0 flex-1 flex-col">
            <header className="flex flex-col gap-4 border-b border-zinc-200/70 bg-zinc-100 px-4 py-5 dark:border-zinc-800 dark:bg-[#161616] md:flex-row md:items-start md:justify-between md:px-6">
              <div className="max-w-3xl space-y-3">
                <Link
                  href="/dashboard/tenancies"
                  className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 transition-colors hover:text-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
                  Tenancies
                </Link>
                <p className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Tenancy
                </p>
                <h1 className="font-headline text-[22px] font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white sm:text-[24px]">
                  {detail.propertyAddress ?? "Property"}
                </h1>
                <p className="font-[family-name:var(--font-inter)] text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {detail.tenantName ?? "Tenant"}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-600"> · </span>
                  Dates, financials, referencing, and onboarding in one place.
                </p>
              </div>
              {userId ? (
                <div className="shrink-0 md:pt-1">
                  <EditTenancyDialog
                    tenancyId={id}
                    userId={userId}
                    initial={{
                      startDate,
                      endDate,
                      moveInDate,
                      monthlyRent,
                      depositAmount: deposit,
                      status: tenancyStatus,
                    }}
                    triggerLabel="Edit tenancy"
                  />
                </div>
              ) : null}
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-px bg-zinc-200/70 dark:bg-zinc-800">
              <section className="bg-[#f8f8f7] dark:bg-[#1A1A1A]">
                <div className="border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800 md:px-6">
                  <h2 className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    Dates &amp; financials
                  </h2>
                </div>
                <div className="grid gap-x-6 gap-y-5 px-4 py-5 sm:grid-cols-2 md:grid-cols-3 md:px-6 md:py-6">
                  <div className="space-y-1.5">
                    <span className={TENANCY_LABEL}>Start date</span>
                    <p className="font-[family-name:var(--font-inter)] text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                      {startDate ?? "—"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className={TENANCY_LABEL}>End date</span>
                    <p className="font-[family-name:var(--font-inter)] text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                      {endDate ?? "—"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className={TENANCY_LABEL}>Move-in date</span>
                    <p className="font-[family-name:var(--font-inter)] text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                      {moveInDate ?? "—"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className={TENANCY_LABEL}>Status</span>
                    <p className="font-[family-name:var(--font-inter)] text-[13px] font-medium capitalize text-zinc-900 dark:text-zinc-100">
                      {tenancyStatus ?? "—"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className={TENANCY_LABEL}>Monthly rent</span>
                    <p className="font-[family-name:var(--font-inter)] text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                      {monthlyRent != null && Number.isFinite(monthlyRent) ? gbp.format(monthlyRent) : "—"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className={TENANCY_LABEL}>Deposit</span>
                    <p className="font-[family-name:var(--font-inter)] text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                      {deposit != null && Number.isFinite(deposit) ? gbp.format(deposit) : "—"}
                    </p>
                  </div>
                </div>
              </section>

              {userId ? (
                <ReferencingPanel
                  tenancyId={id}
                  userId={userId}
                  initialEvents={referencingEvents}
                  referencingToken={detail.referencing_token}
                  referencingAgencyEmailOverride={detail.referencing_agency_email_override}
                  defaultReferencingAgencyEmail={defaultReferencingAgencyEmail}
                  hasDefaultReferencingAgencyEmail={hasDefaultReferencingAgencyEmail}
                  lastOutboundAt={detail.referencing_last_outbound_at}
                  lastInboundAt={detail.referencing_last_inbound_at}
                  onboardingStatus={detail.onboarding_status}
                />
              ) : null}
              <TenancyOnboardingPanel
                tenancyId={id}
                onboardingStatus={detail.onboarding_status}
                tasks={detail.tasks}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
