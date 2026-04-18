import Link from "next/link";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";

import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyIntelligenceDock } from "@/components/properties/property-intelligence-dock";
import type { PropertyPortfolioRow } from "@/lib/actions/properties";
import { cn } from "@/lib/utils";

function formatRelativeEn(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "min" : "mins"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function quarterLabel(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `Q${q} ${now.getFullYear()}`;
}

export function ManagedPropertiesRegistry({ rows }: { rows: PropertyPortfolioRow[] }) {
  const avgOcc =
    rows.length === 0
      ? 0
      : rows.reduce((acc, r) => acc + r.occupancyPct, 0) / rows.length;

  const attention = rows.find((r) => r.maintenanceState === "attention");

  const intelInsight = rows.some((r) => r.occupancyPct >= 95)
    ? `Occupancy at ${rows.find((r) => r.occupancyPct >= 95)?.identityTitle ?? "your top asset"} is strong. Shall I draft lease paperwork or chase any arrears?`
    : `I can summarize rent performance across your properties or draft notices. What should we tackle first?`;

  return (
    <div className="relative min-h-0 flex-1 bg-background">
      <section className="px-4 pb-6 pt-2 sm:px-6 md:px-12 md:pb-32 md:pt-4">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:gap-8 md:mb-20 md:flex-row md:items-end">
          <div>
            <h1 className="font-headline text-2xl font-extralight tracking-[0.05em] text-foreground sm:text-3xl md:text-5xl">
              Managed Properties
            </h1>
            <div className="mt-3 hidden items-center gap-4 sm:flex">
              <span className="h-px w-12 bg-[#BD9952]" aria-hidden />
              <p className="font-[family-name:var(--font-inter)] text-sm uppercase tracking-widest text-muted-foreground">
                Portfolio overview • {quarterLabel()}
              </p>
            </div>
          </div>
          <AddPropertyDialog
            trigger={
              <button
                type="button"
                className="group relative overflow-hidden rounded-sm px-8 py-3 transition-all duration-300"
              >
                <span className="absolute inset-0 bg-gradient-to-tr from-[#C9C6C5] to-[#474646]" aria-hidden />
                <span className="relative flex items-center gap-3 font-[family-name:var(--font-inter)] text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-[#414040]">
                  <Plus className="size-4" strokeWidth={2} aria-hidden />
                  New property
                </span>
              </button>
            }
          />
        </div>

        {rows.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center border border-border bg-card px-8 py-20 text-center">
            <p className="font-headline text-xl font-light text-foreground">No properties yet</p>
            <p className="mt-2 max-w-md font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
              Add your first asset to populate your portfolio matrix.
            </p>
            <div className="mt-8">
              <AddPropertyDialog
                trigger={
                  <button
                    type="button"
                    className="group relative overflow-hidden rounded-sm px-8 py-3 transition-all duration-300"
                  >
                    <span className="absolute inset-0 bg-gradient-to-tr from-[#C9C6C5] to-[#474646]" aria-hidden />
                    <span className="relative flex items-center gap-3 font-[family-name:var(--font-inter)] text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-[#414040]">
                      <Plus className="size-4" strokeWidth={2} aria-hidden />
                      New property
                    </span>
                  </button>
                }
              />
            </div>
          </div>
        ) : (
          <>
            <div className="md:hidden">
              <ul className="space-y-3">
                {rows.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/properties/${p.id}`}
                      className="group block rounded-sm border border-border/80 bg-card px-4 py-4 transition-colors hover:border-[#BD9952]/60 hover:bg-muted/60 active:bg-muted/80"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-headline truncate text-base font-light text-foreground">
                            {p.identityTitle}
                          </h3>
                          <p className="mt-1 truncate font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                            {p.identitySubline}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {p.maintenanceState === "attention" ? (
                            <AlertTriangle className="size-3.5 text-[#BB5551]" aria-hidden />
                          ) : (
                            <CheckCircle2 className="size-3.5 text-[#BD9952]" aria-hidden />
                          )}
                          <span className="font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                            {p.maintenanceState === "attention" ? "Attention" : "Optimal"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
                        <div>
                          <p className="font-[family-name:var(--font-inter)] text-[0.55rem] uppercase tracking-widest text-muted-foreground">
                            Occupancy
                          </p>
                          <p className="mt-1 font-headline text-lg font-light text-foreground">
                            {p.occupancyPct.toFixed(p.occupancyPct === 100 ? 0 : 1)}%
                          </p>
                        </div>
                        <div>
                          <p className="font-[family-name:var(--font-inter)] text-[0.55rem] uppercase tracking-widest text-muted-foreground">
                            Yield
                          </p>
                          <p className="mt-1 font-headline text-lg font-light text-foreground">
                            {p.yieldPctLabel}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 truncate font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                        {p.lastActionTitle} · {formatRelativeEn(p.lastActionAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hidden space-y-1 md:block">
              <div className="mb-4 grid grid-cols-12 border-b border-border/80 px-6 py-4 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                <div className="col-span-4">Property identity</div>
                <div className="col-span-2 text-center">Occupancy</div>
                <div className="col-span-2 text-center">Annual yield</div>
                <div className="col-span-2 text-center">Maintenance</div>
                <div className="col-span-2 text-right">Last action</div>
              </div>

              {rows.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/properties/${p.id}`}
                  className={cn(
                    "grid grid-cols-12 items-center border-l-2 border-transparent px-6 py-8 transition-all duration-300",
                    "bg-card hover:border-[#BD9952] hover:bg-muted/80 dark:hover:bg-[#1F2020]",
                    "group cursor-pointer",
                  )}
                >
                  <div className="col-span-4 flex items-center gap-6">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-sm bg-[#252626] grayscale transition-all duration-500 group-hover:grayscale-0">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#2a2a2a] to-[#131313]" />
                      <div className="absolute inset-0 flex items-center justify-center font-headline text-lg font-extralight text-white/90">
                        {p.identityTitle.slice(0, 1)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-headline text-lg font-light tracking-wide text-foreground">
                        {p.identityTitle}
                      </h3>
                      <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                        {p.identitySubline}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-2 flex flex-col items-center">
                    <span className="font-headline text-xl font-light text-foreground">
                      {p.occupancyPct.toFixed(p.occupancyPct === 100 ? 0 : 1)}%
                    </span>
                    <div className="mt-3 h-1 w-24 overflow-hidden bg-[#252626]">
                      <div
                        className="h-full bg-[#BD9952]"
                        style={{ width: `${Math.min(100, p.occupancyPct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="col-span-2 text-center">
                    <span className="font-headline text-xl font-light text-foreground">
                      {p.yieldPctLabel}
                    </span>
                    <p className="mt-2 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                      {p.yieldTierLabel}
                    </p>
                  </div>

                  <div className="col-span-2 flex flex-col items-center">
                    <div className="flex items-center gap-2">
                      {p.maintenanceState === "attention" ? (
                        <AlertTriangle className="size-4 shrink-0 text-[#BB5551]" aria-hidden />
                      ) : (
                        <CheckCircle2 className="size-4 shrink-0 text-[#BD9952]" aria-hidden />
                      )}
                      <span className="text-sm font-light text-foreground">
                        {p.maintenanceState === "attention" ? "Attention" : "Optimal"}
                      </span>
                    </div>
                    <p className="mt-2 text-center font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                      {p.maintenanceDetail}
                    </p>
                  </div>

                  <div className="col-span-2 text-right">
                    <p className="text-sm font-light text-foreground">{p.lastActionTitle}</p>
                    <p className="mt-2 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                      {formatRelativeEn(p.lastActionAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-12 hidden grid-cols-1 gap-12 sm:grid md:mt-24 lg:grid-cols-12">
              <div className="rounded-sm border-b-2 border-[#BD9952]/20 bg-muted/80 p-10 ring-1 ring-border dark:bg-[#1F2020] lg:col-span-5 lg:p-12">
                <h4 className="mb-8 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Portfolio health intelligence
                </h4>
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-light text-foreground">Average occupancy</span>
                    <span className="font-headline text-2xl font-light text-foreground">
                      {avgOcc.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-light text-foreground">Capital appreciation</span>
                    <span className="font-headline text-2xl font-light text-muted-foreground">—</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-light text-foreground">Operating costs</span>
                    <span className="font-headline text-2xl font-light text-muted-foreground">—</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-center lg:col-span-7">
                <div className="max-w-[28rem]">
                  <h4 className="mb-4 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                    Strategic advisory
                  </h4>
                  <p className="font-headline text-xl font-light leading-relaxed text-foreground">
                    &ldquo;
                    {attention ? (
                      <>
                        The current portfolio shows strong stability in core urban markets. We recommend a tactical
                        shift towards the{" "}
                        <span className="italic text-[#BD9952]">{attention.identityTitle}</span> maintenance cycle to
                        preserve premium yields.
                      </>
                    ) : (
                      <>
                        The current portfolio shows strong stability in core urban markets. Review occupancy and rent
                        roll regularly to preserve premium yields.
                      </>
                    )}
                    &rdquo;
                  </p>
                  <div className="mt-8 flex flex-wrap gap-4">
                    <Link
                      href="/dashboard/settings?agentRuns=1"
                      className="border-b border-[#BD9952]/40 pb-1 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-widest text-[#BD9952] transition-colors hover:border-[#BD9952]"
                    >
                      Download Q4 report
                    </Link>
                    <Link
                      href="/dashboard/activity"
                      className="border-b border-[#484848]/40 pb-1 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-widest text-muted-foreground transition-colors hover:border-muted-foreground"
                    >
                      View analytics
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <PropertyIntelligenceDock insight={intelInsight} />
    </div>
  );
}
