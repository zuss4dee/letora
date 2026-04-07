import Link from "next/link";

import type { LeadListRow } from "@/lib/actions/leads";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

/** Dashboard snapshot for leads — full pipeline lives on `/dashboard/leads`. */
export function LetoraTransactionPipeline({ leads }: { leads: LeadListRow[] }) {
  const count = leads.length;
  const primary = leads[0];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="font-headline text-xl font-light tracking-tight text-[#C9C6C5]">
          Leads
        </h2>
      </div>
      <Link
        href="/dashboard/leads"
        className="group block border border-[#484848]/15 bg-[#131313] p-8 transition-colors hover:border-[#BD9952]/25 hover:bg-[#1F2020]/40"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-inter)] text-sm text-[#ACABAA]">
              {count === 0
                ? "No applicants in your pipeline yet."
                : `${count} applicant${count === 1 ? "" : "s"} in your pipeline`}
            </p>
            {primary ? (
              <p className="font-headline mt-3 text-lg font-light leading-snug text-[#E7E5E4]">
                Next up: {primary.name}
                <span className="ml-2 font-[family-name:var(--font-inter)] text-[0.65rem] capitalize tracking-[0.06em] text-[#BD9952]">
                  {formatStatus(primary.status)}
                </span>
              </p>
            ) : (
              <p className="font-headline mt-3 text-lg font-light text-[#E7E5E4]">
                Add applicants on the leads board
              </p>
            )}
          </div>
          <span className="shrink-0 font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-[0.2em] text-[#BD9952] transition-colors group-hover:text-[#C9C6C5]">
            Open leads board →
          </span>
        </div>
      </Link>
    </div>
  );
}
