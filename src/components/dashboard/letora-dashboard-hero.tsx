"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function LetoraDashboardHero({
  greetingName,
  className,
}: {
  greetingName: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mb-16 flex flex-col items-center pt-8 text-center md:pt-12",
        className,
      )}
    >
      <p className="mb-4 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.2em] text-[#ACABAA]">
        Hi, {greetingName}
      </p>
      <h1 className="font-headline mb-10 max-w-4xl text-3xl font-extralight tracking-tight text-[#E7E5E4] sm:text-4xl md:text-5xl md:text-nowrap">
        What needs attention today?
      </h1>
      <Link
        href="/dashboard/assistant"
        className="block w-full max-w-4xl text-left transition-opacity hover:opacity-90"
      >
        <div className="flex gap-4 border-b border-[#484848]/30 bg-[#131313] px-6 py-6 font-headline text-base font-light leading-relaxed text-[#484848] transition-colors hover:border-[#BD9952]/50 hover:text-[#ACABAA] sm:gap-5 sm:px-8 sm:text-lg md:text-xl">
          <Sparkles
            className="mt-0.5 size-7 shrink-0 text-[#ACABAA] stroke-[1]"
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            Ask Letora to chase rent, draft letters, qualify a lead, or triage maintenance. Mention a property
            or person for live portfolio context.
          </span>
        </div>
      </Link>
      <div className="mt-8 flex flex-wrap justify-center gap-3 md:gap-4">
        <Link
          href="/dashboard/emails"
          className="rounded-full border border-[#484848]/30 px-5 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.1em] text-[#ACABAA] transition-all hover:border-[#BD9952]/50 hover:bg-[#BD9952]/5 hover:text-[#C9C6C5]"
        >
          Email inbox
        </Link>
        <Link
          href="/dashboard/assistant"
          className="rounded-full border border-[#484848]/30 px-5 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.1em] text-[#ACABAA] transition-all hover:border-[#BD9952]/50 hover:bg-[#BD9952]/5 hover:text-[#C9C6C5]"
        >
          Open assistant
        </Link>
        <Link
          href="/dashboard/settings"
          className="rounded-full border border-[#484848]/30 px-5 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.1em] text-[#ACABAA] transition-all hover:border-[#BD9952]/50 hover:bg-[#BD9952]/5 hover:text-[#C9C6C5]"
        >
          Workspace settings
        </Link>
      </div>
    </section>
  );
}
