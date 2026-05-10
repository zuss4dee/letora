import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

const STRIPS: {
  kicker: string;
  title: string;
  body: string;
  src: string;
  alt: string;
}[] = [
  {
    kicker: "Dashboard",
    title: "Command surface for the whole portfolio",
    body:
      "KPIs, transaction pipeline, and a live intelligence feed in one dark, calm layout. You scan health, arrears, and maintenance without jumping between tools.",
    src: "/marketing/screen-87c73e81-8e33-4b3c-8812-1cfc755f136e.png",
    alt: "Letora dashboard showing portfolio metrics, pipeline stages, and recent activity",
  },
  {
    kicker: "Rent",
    title: "Rent tracker with collection clarity",
    body:
      "Expected versus collected rent, arrears, and what is due next: built for UK landlords who need numbers they can trust before they chase.",
    src: "/marketing/screen-fd793805-feed-4797-9c28-cb6608807103.png",
    alt: "Letora rent tracker with summary cards and payment status table",
  },
  {
    kicker: "Properties",
    title: "Managed stock at a glance",
    body:
      "Every address with occupancy context, yield signals, and maintenance posture so you know where to intervene before tenants escalate.",
    src: "/marketing/screen-247c48bb-8371-4de4-bb4f-2a6fbc3f50a2.png",
    alt: "Letora managed properties table with occupancy and maintenance indicators",
  },
];

export function LetoraProductFeaturesSection() {
  return (
    <section
      id="features"
      className="scroll-mt-24 border-t border-border dark:border-[#4F4632]/10 bg-background dark:bg-[#0e0e0e] px-6 py-24 md:px-12 lg:px-24 lg:py-32"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-screen-2xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">
            Product
          </p>
          <h2
            id="features-heading"
            className="mt-4 font-headline text-4xl font-bold tracking-[-0.04em] text-foreground md:text-5xl"
          >
            Inside the platform
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-[family-name:var(--font-inter)] text-base font-light leading-relaxed text-foreground md:text-lg">
            Real screens from the Letora workspace: editorial dark UI, neutral accents, and data you can act on.
          </p>
        </div>

        <div className="mt-20 flex flex-col gap-24 lg:gap-28">
          {STRIPS.map((item, i) => {
            const copyOnLeft = i % 2 === 0;
            return (
              <div
                key={item.src}
                className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:grid-rows-1 lg:gap-16"
              >
                <div
                  className={cn(
                    "min-w-0 space-y-5",
                    copyOnLeft ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-2 lg:row-start-1",
                    copyOnLeft ? "lg:pr-4" : "lg:pl-4",
                  )}
                >
                  <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    {item.kicker}
                  </p>
                  <h3 className="font-headline text-3xl font-light tracking-[-0.03em] text-foreground md:text-4xl">
                    {item.title}
                  </h3>
                  <p className="font-[family-name:var(--font-inter)] text-base font-light leading-relaxed text-muted-foreground md:text-[1.05rem]">
                    {item.body}
                  </p>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 pt-2 font-[family-name:var(--font-inter)] text-sm font-semibold uppercase tracking-widest text-emerald-500 transition-transform hover:translate-x-1"
                  >
                    Start with Letora <ArrowRight className="size-4 shrink-0" aria-hidden />
                  </Link>
                </div>

                <div
                  className={cn(
                    "group relative min-w-0 overflow-hidden rounded-2xl border border-border dark:border-[#4F4632]/20 bg-background dark:bg-[#131313] shadow-[0_32px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.04] transition-shadow duration-500 hover:shadow-[0_40px_96px_rgba(0,0,0,0.55)]",
                    copyOnLeft ? "lg:col-start-2 lg:row-start-1" : "lg:col-start-1 lg:row-start-1",
                  )}
                >
                  <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#0e0e0e]/40 via-transparent to-transparent opacity-60" />
                  <div className="relative aspect-[16/10] w-full max-w-full">
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
                      priority={i === 0}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
