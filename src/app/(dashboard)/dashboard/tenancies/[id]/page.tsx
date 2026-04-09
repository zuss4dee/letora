import Link from "next/link";
import { notFound } from "next/navigation";

import { EditTenancyDialog } from "@/components/tenancies/edit-tenancy-dialog";
import { ReferencingPanel } from "@/components/tenancies/referencing-panel";
import { TenancyOnboardingPanel } from "@/components/tenancies/tenancy-onboarding-panel";
import { TENANCY_LABEL, TENANCY_STAT_TILE } from "@/components/tenancies/tenancy-letora-surfaces";
import { getReferencingEvents } from "@/lib/actions/referencing";
import { getTenancyOnboardingDetail } from "@/lib/actions/onboarding";
import { createClient } from "@/lib/supabase/server";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default async function TenancyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    <div className="@container/main relative flex flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,420px)] bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(189,153,82,0.12),transparent_65%)] dark:bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(61,26,10,0.35),transparent_65%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-10 py-8 md:py-10">
        <header className="flex flex-col gap-6 px-4 lg:flex-row lg:items-end lg:justify-between lg:px-6">
          <div className="max-w-3xl space-y-3">
            <Link
              href="/dashboard/tenancies"
              className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-sm font-medium text-muted-foreground transition-colors hover:text-[#BD9952]"
            >
              <span aria-hidden>←</span> Tenancies
            </Link>
            <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#BD9952]/95">
              Tenancy
            </p>
            <h1 className="font-headline text-3xl font-extralight tracking-[-0.04em] text-foreground md:text-[2.15rem] md:leading-tight">
              {detail.propertyAddress ?? "Property"}
            </h1>
            <p className="font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
              {detail.tenantName ?? "Tenant"} · Dates, financials, referencing, and onboarding in one place.
            </p>
          </div>
          {userId ? (
            <div className="shrink-0 lg:pb-1">
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

        <section className="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-6">
          <div className={TENANCY_STAT_TILE}>
            <div className={TENANCY_LABEL}>Start date</div>
            <div className="mt-1 font-[family-name:var(--font-inter)] text-base font-medium text-foreground">
              {startDate ?? "—"}
            </div>
          </div>
          <div className={TENANCY_STAT_TILE}>
            <div className={TENANCY_LABEL}>End date</div>
            <div className="mt-1 font-[family-name:var(--font-inter)] text-base font-medium text-foreground">
              {endDate ?? "—"}
            </div>
          </div>
          <div className={TENANCY_STAT_TILE}>
            <div className={TENANCY_LABEL}>Move-in date</div>
            <div className="mt-1 font-[family-name:var(--font-inter)] text-base font-medium text-foreground">
              {moveInDate ?? "—"}
            </div>
          </div>
          <div className={TENANCY_STAT_TILE}>
            <div className={TENANCY_LABEL}>Status</div>
            <div className="mt-1 font-[family-name:var(--font-inter)] text-base font-medium capitalize text-foreground">
              {tenancyStatus ?? "—"}
            </div>
          </div>
          <div className={TENANCY_STAT_TILE}>
            <div className={TENANCY_LABEL}>Monthly rent</div>
            <div className="mt-1 font-[family-name:var(--font-inter)] text-base font-medium text-foreground">
              {monthlyRent != null && Number.isFinite(monthlyRent) ? gbp.format(monthlyRent) : "—"}
            </div>
          </div>
          <div className={TENANCY_STAT_TILE}>
            <div className={TENANCY_LABEL}>Deposit</div>
            <div className="mt-1 font-[family-name:var(--font-inter)] text-base font-medium text-foreground">
              {deposit != null && Number.isFinite(deposit) ? gbp.format(deposit) : "—"}
            </div>
          </div>
        </section>

        <section className="grid gap-6 px-4 lg:px-6">
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
        </section>
      </div>
    </div>
  );
}
