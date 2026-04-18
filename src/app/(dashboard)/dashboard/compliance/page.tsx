import { ComplianceOnboardingModal } from "@/components/compliance/compliance-onboarding-modal";
import { ComplianceDashboard } from "@/components/compliance/compliance-dashboard";
import { ComplianceOverviewSection } from "@/components/compliance/compliance-overview-section";
import { getComplianceRecordsForUser } from "@/lib/actions/compliance";
import { computeCompliancePortfolioSummary } from "@/lib/compliance/portfolio-summary";
import { getProperties, getPropertyById } from "@/lib/actions/properties";
import type { ExpiredComplianceItem, PortfolioHealthAlertRow } from "@/lib/portfolio/check-portfolio-health";
import { syncAndGetPortfolioHealthAlerts } from "@/lib/portfolio/check-portfolio-health";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ onboard?: string }>;
}) {
  const sp = await searchParams;
  const onboardId = sp.onboard?.trim() ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const [properties, records, onboardProperty, portfolioSync] = await Promise.all([
    userId ? getProperties(userId) : Promise.resolve([]),
    userId ? getComplianceRecordsForUser(userId) : Promise.resolve([]),
    userId && onboardId ? getPropertyById(userId, onboardId) : Promise.resolve(null),
    userId
      ? syncAndGetPortfolioHealthAlerts(userId, supabase)
      : Promise.resolve({ expired: [] as ExpiredComplianceItem[], alerts: [] as PortfolioHealthAlertRow[] }),
  ]);

  const complianceSummary = computeCompliancePortfolioSummary(properties, records);

  const showOnboardModal = Boolean(onboardId && onboardProperty);

  return (
    <div className="@container/main relative flex flex-1 flex-col">
      <ComplianceOnboardingModal
        propertyId={showOnboardModal && onboardProperty ? onboardProperty.id : null}
        hasGasSupply={onboardProperty?.hasGasSupply ?? true}
        open={showOnboardModal}
      />

      {/* Layered atmosphere — registry / vault */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-[min(48vh,480px)] bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(189,153,82,0.14),transparent_62%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(189,153,82,0.11),transparent_60%)]" />
        <div className="absolute -right-[20%] top-[20%] h-[min(55vh,520px)] w-[min(55vh,520px)] rounded-full bg-[radial-gradient(circle_at_center,rgba(71,70,70,0.35),transparent_68%)] opacity-80 dark:opacity-100" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#BD9952]/25 to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "128px 128px",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-12 lg:px-12">
        {userId ? (
          <ComplianceOverviewSection
            className="compliance-card-enter mb-6 max-w-5xl md:mb-10"
            portfolioAlerts={portfolioSync.alerts}
            summary={complianceSummary}
          />
        ) : null}
        <header className="compliance-card-enter mb-6 max-w-3xl space-y-3 md:mb-12 md:space-y-5" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-gradient-to-r from-[#BD9952] to-transparent" aria-hidden />
            <p className="font-headline text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#BD9952]">
              Portfolio
            </p>
          </div>
          <div className="space-y-3">
            <h1 className="font-headline text-2xl font-extralight tracking-[-0.045em] text-foreground sm:text-3xl md:text-5xl md:leading-[1.08]">
              Compliance
              <span className="block text-base font-light tracking-normal text-muted-foreground md:inline md:text-2xl md:font-extralight">
                {" "}
                <span className="text-[#BD9952]/90">·</span> certificate register
              </span>
            </h1>
            <p className="font-headline hidden max-w-xl text-base font-light leading-relaxed text-muted-foreground sm:block md:text-[1.05rem]">
              EPC, gas safety, and electrical (EICR) in one ledger. Set expiries, attach PDFs, and see what needs an
              engineer before it becomes a liability.
            </p>
          </div>
        </header>

        <ComplianceDashboard properties={properties} records={records} />
      </div>
    </div>
  );
}
