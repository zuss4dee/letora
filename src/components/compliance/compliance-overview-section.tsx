import { ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortfolioHealthAlertRow } from "@/lib/portfolio/check-portfolio-health";

export function ComplianceOverviewSection({
  portfolioAlerts,
  summary,
  className,
}: {
  portfolioAlerts: PortfolioHealthAlertRow[];
  summary: { expired: number; missing: number; valid: number };
  className?: string;
}) {
  const complianceRows = portfolioAlerts.filter((a) => a.payload?.type === "compliance_expired");

  return (
    <div className={cn("space-y-8", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card/40 px-5 py-4 dark:bg-card/20">
          <span className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Expired
          </span>
          <span className="font-headline text-3xl font-extralight tabular-nums text-foreground">{summary.expired}</span>
          <p className="font-headline text-[0.65rem] font-light text-muted-foreground">Past legal date</p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card/40 px-5 py-4 dark:bg-card/20">
          <span className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Missing
          </span>
          <span className="font-headline text-3xl font-extralight tabular-nums text-foreground">{summary.missing}</span>
          <p className="font-headline text-[0.65rem] font-light text-muted-foreground">PDF or expiry gap</p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card/40 px-5 py-4 dark:bg-card/20">
          <span className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Valid
          </span>
          <span className="font-headline text-3xl font-extralight tabular-nums text-emerald-500">{summary.valid}</span>
          <p className="font-headline text-[0.65rem] font-light text-muted-foreground">In good standing</p>
        </div>
      </div>

      {complianceRows.length > 0 ? (
        <Card className="border-destructive/30 bg-gradient-to-br from-destructive/[0.04] via-card/90 to-card shadow-sm dark:border-destructive/25">
          <CardHeader className="border-b border-destructive/10 pb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 shrink-0 text-destructive" aria-hidden />
              <CardTitle className="font-headline text-base text-foreground">Compliance — action required</CardTitle>
            </div>
            <p className="font-headline text-sm font-light text-muted-foreground">
              Expired certificates in your portfolio. Renew or book an engineer before they become a liability.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {complianceRows.map((a) => {
              const p = a.payload;
              if (!p) return null;
              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-destructive/10 bg-card/80 px-3 py-2.5 dark:bg-card/50"
                >
                  <p className="font-headline text-sm font-medium text-foreground">
                    {p.propertyAddress} — <span className="text-destructive">{p.certificateType}</span> expired
                  </p>
                  <p className="mt-1 font-headline text-xs text-muted-foreground">
                    {a.created_at ? new Date(a.created_at).toLocaleString("en-GB") : "—"}
                  </p>
                  <p className="mt-2 font-headline text-sm font-light text-muted-foreground">
                    Address details in the register below.
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
