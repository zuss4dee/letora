import Link from "next/link";

import { cn } from "@/lib/utils";

export function LetoraAiInsightCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border border-[#BD9952]/20 bg-[#1F2020]/40 p-8 backdrop-blur-md",
        className,
      )}
    >
      <div className="relative overflow-hidden">
        <div className="absolute -right-16 -top-16 size-32 rounded-full bg-[#BD9952]/5 blur-3xl" />
        <div className="relative mb-4 flex items-center gap-3">
          <span className="font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-[0.2em] text-[#BD9952]">
            AI insight
          </span>
        </div>
        <p className="font-headline mb-6 text-[0.8rem] italic leading-relaxed text-foreground">
          &ldquo;Review overdue rent and maintenance requests together to prioritise cashflow and compliance this
          week.&rdquo;
        </p>
        <Link
          href="/dashboard/settings?agentRuns=1"
          className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-widest text-foreground transition-colors hover:text-[#BD9952]"
        >
          Initialize strategy <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
