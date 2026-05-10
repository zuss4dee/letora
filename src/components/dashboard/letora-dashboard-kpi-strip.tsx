import Link from "next/link";
import { Construction, Landmark, TrendingUp } from "lucide-react";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export type LetoraDashboardKpiStripProps = {
  activeTenancies: number;
  totalProperties: number;
  monthlyRent: number;
  rentCollectedThisMonth: number;
  overduePayments: number;
  openMaintenance: number;
};

export function LetoraDashboardKpiStrip({
  activeTenancies,
  totalProperties,
  monthlyRent,
  rentCollectedThisMonth,
  overduePayments,
  openMaintenance,
}: LetoraDashboardKpiStripProps) {
  const collectionPct =
    monthlyRent > 0
      ? Math.min(100, Math.round((rentCollectedThisMonth / monthlyRent) * 1000) / 10)
      : null;
  const criticalArrears = overduePayments;

  return (
    <section className="mb-16 mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <div className="flex flex-col gap-4 border border-border bg-card p-8">
        <div className="flex items-start justify-between">
          <span className="font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-[0.15em] text-muted-foreground">
            Active tenancies
          </span>
          <TrendingUp className="size-[18px] text-muted-foreground stroke-[1.25]" aria-hidden />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-headline text-3xl font-light text-foreground">
            {String(activeTenancies)}
          </span>
          {totalProperties > 0 ? (
            <span className="font-[family-name:var(--font-inter)] text-xs text-[#BD9952]">
              {totalProperties} propert{totalProperties === 1 ? "y" : "ies"}
            </span>
          ) : null}
        </div>
        <p className="font-[family-name:var(--font-inter)] text-[0.625rem] text-muted-foreground">
          Across your portfolio
        </p>
      </div>

      <div className="flex flex-col gap-4 border border-border bg-card p-8">
        <div className="flex items-start justify-between">
          <span className="font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-[0.15em] text-muted-foreground">
            Collection rate
          </span>
          <Landmark className="size-[18px] text-muted-foreground stroke-[1.25]" aria-hidden />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-headline text-3xl font-light text-foreground">
            {collectionPct != null ? `${collectionPct}%` : "—"}
          </span>
          {monthlyRent > 0 ? (
            <span className="font-[family-name:var(--font-inter)] text-xs text-[#BD9952]">
              {gbp.format(rentCollectedThisMonth)} / {gbp.format(monthlyRent)}
            </span>
          ) : null}
        </div>
        <p className="font-[family-name:var(--font-inter)] text-[0.625rem] text-muted-foreground">
          Collected this month vs rent roll
        </p>
      </div>

      <Link
        href="/dashboard/rent-tracker"
        className="group flex flex-col gap-4 border border-border bg-card p-8 transition-colors hover:bg-muted/80 dark:hover:bg-background dark:bg-[#1F2020]/80"
      >
        <div className="flex items-start justify-between">
          <span className="font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-[0.15em] text-muted-foreground">
            Arrears at risk
          </span>
          <span className="font-[family-name:var(--font-inter)] text-lg text-[#BB5551]" aria-hidden>
            !
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-headline text-3xl font-light text-foreground">
            {String(overduePayments)}
          </span>
          {criticalArrears > 0 ? (
            <span className="font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-wider text-[#BB5551]">
              {criticalArrears} critical
            </span>
          ) : null}
        </div>
        <p className="font-[family-name:var(--font-inter)] text-[0.625rem] text-muted-foreground">
          Open rent tracker
        </p>
      </Link>

      <Link
        href="/dashboard/maintenance"
        className="group flex flex-col gap-4 border border-border bg-card p-8 transition-colors hover:bg-muted/80 dark:hover:bg-background dark:bg-[#1F2020]/80"
      >
        <div className="flex items-start justify-between">
          <span className="font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-[0.15em] text-muted-foreground">
            Maintenance
          </span>
          <Construction className="size-[18px] text-muted-foreground stroke-[1.25]" aria-hidden />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-headline text-3xl font-light text-foreground">
            {String(openMaintenance)}
          </span>
          <span className="font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Open requests
          </span>
        </div>
        <p className="font-[family-name:var(--font-inter)] text-[0.625rem] text-muted-foreground">
          Tracked in maintenance
        </p>
      </Link>
    </section>
  );
}
