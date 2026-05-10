import Link from "next/link";

import type { LeadListRow } from "@/lib/actions/leads";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

/** Dashboard snapshot for leads; full pipeline lives on `/dashboard/leads`. */
export function LetoraTransactionPipeline({ leads }: { leads: LeadListRow[] }) {
  const count = leads.length;
  const primary = leads[0];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="font-headline text-xl font-light tracking-tight text-foreground">
          Leads
        </h2>
      </div>
      <Link
        href="/dashboard/leads"
        className="group block border border-border bg-card p-8 transition-colors hover:border-secondary/30 hover:bg-muted/70 dark:hover:bg-background dark:bg-[#1F2020]/40"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
              {count === 0
                ? "No applicants in your pipeline yet."
                : `${count} applicant${count === 1 ? "" : "s"} in your pipeline`}
            </p>
            {primary ? (
              <p className="font-headline mt-3 text-lg font-light leading-snug text-foreground">
                Next up: {primary.name}
                <span className="ml-2 font-[family-name:var(--font-inter)] text-[0.65rem] capitalize tracking-[0.06em] text-[#BD9952]">
                  {formatStatus(primary.status)}
                </span>
              </p>
            ) : (
              <p className="font-headline mt-3 text-lg font-light text-foreground">
                Add applicants on the leads board
              </p>
            )}
          </div>
          <span className="shrink-0 font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-[0.2em] text-[#BD9952] transition-colors group-hover:text-foreground">
            Open leads board →
          </span>
        </div>
      </Link>
    </div>
  );
}
