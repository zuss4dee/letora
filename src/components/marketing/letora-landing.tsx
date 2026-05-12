"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { LetoraProductFeaturesSection } from "@/components/marketing/letora-product-features";
import { LetoraPricingSection } from "@/components/marketing/letora-pricing";

const IMG_LEAD =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBg5ajTNLCjulmmX_dzDzz5V1OjcsIG2-7x9YXmXdpWrz3cFD86MoW5Iu2QbD5z8a5kXsF-Bf5rzkjEwMVMPh5pfSQ5LEO8hppXqUFhcDc0Xfij3bN9hw0E6bginOLeVau-VXAoYjMhIyN1_LYbC63ScTruhcAnqJw15H100zSNpjpucrwcd4zB5XEPKEnhzXmX7PWam-OXB8xdLEV_qeBs78pCGpD8AZSMUGrTtJfendAtAYiPa04Dl770aUtU_IQTIJYk7OO_0UEN";

const IMG_GLOBE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAJwPzZOCRCPkluecfYuzUdKNoz3fc9GURwy8fRZYDdzOVEHlyIzNw2DEjHhoKG19xK6hJfUw4Nk1seNEDh10e1JoGNGmSs_FqdEDf9m1NmnvBK9HQAWk7JneCQBXiQR4E9DyKS1s4BuQwkaA4OkQ0DsZZxJwvvsFq6H-7in445dHq8tZuv3E1uqYmjO0TGdDKUiEgku-W9LGiASOC1L_vHerLavogoYbu5y-Nm2nlaTPyq4wwo6nNHinja675cj0ajw6cmCfEv15Rp";

function JewelryButton({
  href,
  children,
  className,
  size = "md",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-white font-semibold text-black shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)] transition-all hover:bg-zinc-100 hover:shadow-[0_0_56px_-8px_rgba(255,255,255,0.3)] active:scale-[0.98] dark:bg-zinc-900 dark:text-zinc-50 dark:shadow-none dark:hover:bg-zinc-800 dark:hover:text-white",
        size === "lg" ? "px-10 py-5 text-lg" : "px-6 py-2.5 text-sm",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function LetoraLanding() {
  return (
    <div className="dark min-h-screen overflow-x-hidden bg-background dark:bg-[#0B0B0B] text-foreground selection:bg-white/10 selection:text-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background dark:bg-[#FFEABB] focus:px-4 focus:py-2 focus:text-[#3e2e00]"
      >
        Skip to content
      </a>

      <MarketingHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-[calc(3.75rem+env(safe-area-inset-top,0px)+1.25rem)] text-center sm:pt-[calc(4rem+env(safe-area-inset-top,0px)+1.5rem)]">
          <div className="pointer-events-none absolute inset-0 z-0 opacity-100">
            <div className="absolute left-1/2 top-[42%] h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_55%_45%_at_50%_50%,rgba(226,226,226,0.07)_0%,transparent_62%)]" />
            <div className="absolute left-1/2 top-1/2 h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle_at_center,rgba(100,118,132,0.045)_0%,transparent_58%)]" />
          </div>
          <div className="relative z-10 max-w-5xl space-y-10 md:space-y-12">
            <h1 className="space-y-3 md:space-y-5">
              <span className="block bg-gradient-to-br from-white via-white to-zinc-500 bg-clip-text font-headline text-6xl font-extrabold leading-[0.92] tracking-[-0.04em] text-transparent md:text-8xl lg:text-9xl">
                Letora
              </span>
              <span className="block font-headline text-3xl font-light leading-tight tracking-[-0.03em] text-foreground md:text-5xl lg:text-6xl">
                Property Operating System
              </span>
            </h1>
            <p className="mx-auto max-w-xl font-[family-name:var(--font-inter)] text-lg font-light leading-relaxed text-foreground md:text-xl">
              One calm surface for UK landlords: leads, rent, tenancies, and maintenance. You approve what goes
              out.
            </p>
            <div className="pt-4">
              <JewelryButton href="/pricing" size="lg">
                Try for free
              </JewelryButton>
            </div>
          </div>
          <a
            href="#lead-intelligence"
            className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 text-muted-foreground transition-colors hover:text-[#FFEABB]/80"
          >
            <span className="font-[family-name:var(--font-inter)] text-[0.65rem] font-light uppercase tracking-[0.3em]">
              Discover more
            </span>
            <ArrowDown className="size-5 animate-bounce" aria-hidden />
          </a>
        </section>

        {/* Lead Intelligence */}
        <section
          id="lead-intelligence"
          className="scroll-mt-24 bg-background dark:bg-[#1b1b1b] px-6 py-24 md:px-12 lg:px-24 lg:py-32"
        >
          <div className="mx-auto grid max-w-screen-2xl grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-20">
            <div className="z-10 space-y-8">
              <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">
                Adaptive AI
              </span>
              <h2 className="font-headline text-5xl font-bold leading-[0.9] tracking-[-0.04em] text-foreground md:text-7xl">
                Lead
                <br />
                Intelligence
              </h2>
              <p className="max-w-md font-[family-name:var(--font-inter)] text-lg font-light leading-relaxed text-foreground md:text-xl">
                See intent before the first reply. Letora scores and qualifies leads from your pipeline so
                your team spends time on tenancies that convert, not on noise.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <span className="h-px w-12 bg-background dark:bg-[#4F4632]/40" aria-hidden />
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-sm font-semibold uppercase tracking-widest text-emerald-500 transition-transform hover:translate-x-1"
                >
                  Explore leads <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </div>
            <div className="relative h-[min(56vh,420px)] w-full min-w-0 overflow-hidden rounded-2xl shadow-2xl sm:h-[400px] lg:h-[min(70vh,560px)]">
              <Image
                src={IMG_LEAD}
                alt="Abstract obsidian and gold light forms suggesting intelligence"
                fill
                className="object-cover opacity-70 grayscale transition-all duration-700 hover:opacity-100 hover:grayscale-0"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#1b1b1b] via-transparent to-transparent" />
            </div>
          </div>
        </section>

        {/* Rent chasing */}
        <section
          id="rent-chasing"
          className="scroll-mt-24 bg-background dark:bg-[#131313] px-6 py-24 md:px-12 lg:px-24 lg:py-32"
        >
          <div className="mx-auto flex max-w-screen-2xl flex-col items-center gap-16 lg:flex-row-reverse lg:gap-16">
            <div className="space-y-8 text-right lg:w-1/2">
              <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">
                Efficiency
              </span>
              <h2 className="font-headline text-5xl font-bold leading-[0.9] tracking-[-0.04em] text-foreground md:text-7xl">
                Automated
                <br />
                Rent chasing
              </h2>
              <div className="flex justify-end">
                <p className="max-w-md font-[family-name:var(--font-inter)] text-lg font-light leading-relaxed text-foreground md:text-xl">
                  Stop chasing spreadsheets. Rent Chaser sends firm, professional follow-ups on your schedule,
                  with drafts you can approve before anything goes out.
                </p>
              </div>
            </div>
            <div className="relative w-full lg:w-1/2">
              <div className="absolute -left-8 top-0 h-64 w-64 rounded-full bg-background dark:bg-[#FFEABB]/5 blur-3xl" aria-hidden />
              <div className="relative z-20 mx-auto max-w-lg translate-y-0 rounded-2xl border border-border dark:border-[#4F4632]/15 bg-[rgba(53,53,53,0.35)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:ml-0 lg:translate-y-10">
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex gap-2">
                    <div className="size-2 rounded-full bg-red-400/40" />
                    <div className="size-2 rounded-full bg-background dark:bg-[#FFEABB]/40" />
                    <div className="size-2 rounded-full bg-background dark:bg-[#c5c5d8]/40" />
                  </div>
                  <span className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest opacity-40">
                    System active
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-background dark:bg-[#1b1b1b] p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-full bg-background dark:bg-[#FFEABB]/10">
                        <span className="text-sm text-[#FFEABB]">£</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">Pending remittance</div>
                        <div className="font-[family-name:var(--font-inter)] text-[10px] text-muted-foreground">
                          Unit 402 · £2,450.00
                        </div>
                      </div>
                    </div>
                    <span className="rounded bg-background dark:bg-[#FFEABB]/20 px-2 py-1 font-[family-name:var(--font-inter)] text-[10px] text-[#FFEABB]">
                      Queued
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border dark:border-[#4F4632]/10 bg-background dark:bg-[#1b1b1b]/60 p-4 opacity-70">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-full bg-background dark:bg-[#c5c5d8]/10">
                        <span className="text-xs text-[#c5c5d8]">✓</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">Settled</div>
                        <div className="font-[family-name:var(--font-inter)] text-[10px] text-muted-foreground">
                          Unit 115 · £1,800.00
                        </div>
                      </div>
                    </div>
                    <span className="rounded border border-border dark:border-[#4F4632]/30 px-2 py-1 font-[family-name:var(--font-inter)] text-[10px]">
                      Clear
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Operations + stats */}
        <section
          id="ai-operations"
          className="scroll-mt-24 bg-background dark:bg-[#0e0e0e] px-6 py-24 md:px-12 lg:px-24 lg:py-32"
        >
          <div className="mx-auto max-w-4xl space-y-16 text-center">
            <div className="space-y-6">
              <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">
                Core engine
              </span>
              <h2 className="font-headline text-5xl font-bold leading-none tracking-[-0.04em] text-foreground md:text-7xl lg:text-8xl">
                AI-first
                <br />
                Operations
              </h2>
              <p className="mx-auto max-w-2xl pt-4 font-[family-name:var(--font-inter)] text-lg font-light leading-relaxed text-foreground md:text-2xl">
                Not another add-on chatbot. Letora is an operator layer across email, tenancies, maintenance,
                and contracts, with a single place to see what needs attention today.
              </p>
            </div>

            <div className="group relative cursor-default">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#FFEABB]/20 to-[#c5c5d8]/20 opacity-25 blur transition duration-700 group-hover:opacity-45" />
              <div className="relative overflow-hidden rounded-2xl border border-border dark:border-[#4F4632]/10">
                <div className="relative aspect-video w-full">
                  <Image
                    src={IMG_GLOBE}
                    alt="Glowing digital globe suggesting connected operations"
                    fill
                    className="object-cover brightness-[0.45] transition-all duration-700 group-hover:brightness-[0.58]"
                    sizes="(max-width: 896px) 100vw, 896px"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-background dark:bg-[#1A1A1A]/50 px-6 py-3 backdrop-blur-md">
                      <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                      <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.25em] text-emerald-500">
                        Live sync
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-12 pt-8 text-left md:grid-cols-3 md:gap-10">
              <div className="space-y-3">
                <div className="font-headline text-3xl font-bold tracking-tighter text-foreground">99.9%</div>
                <div className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-muted-foreground">
                  Uptime target
                </div>
                <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-foreground">
                  Infrastructure built for always-on property operations, not demo-day uptime.
                </p>
              </div>
              <div className="space-y-3">
                <div className="font-headline text-3xl font-bold tracking-tighter text-foreground">&lt;15s</div>
                <div className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-muted-foreground">
                  Typical reply path
                </div>
                <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-foreground">
                  Drafts and agent responses surface fast enough to feel like a live desk, without the desk.
                </p>
              </div>
              <div className="space-y-3">
                <div className="font-headline text-3xl font-bold tracking-tighter text-foreground">∞</div>
                <div className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-muted-foreground">
                  Portfolio scale
                </div>
                <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-foreground">
                  From a handful of doors to a growing portfolio: same surface, same discipline.
                </p>
              </div>
            </div>

            <div className="pt-4">
              <JewelryButton href="/signup" size="md">
                Open the workspace
              </JewelryButton>
            </div>
          </div>
        </section>

        <LetoraProductFeaturesSection />

        <LetoraPricingSection />

        {/* Footer */}
        <footer className="flex flex-col items-center justify-between gap-10 border-t border-border dark:border-[#4F4632]/10 bg-background dark:bg-[#131313] px-6 py-16 md:flex-row md:px-12 lg:px-24">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <span className="font-headline text-xl font-semibold tracking-[-0.04em] text-foreground">Letora</span>
            <p className="font-[family-name:var(--font-inter)] text-[10px] font-light uppercase tracking-[0.2em] text-muted-foreground">
              © {new Date().getFullYear()} Letora. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-10">
            <span className="font-[family-name:var(--font-inter)] text-sm font-light uppercase tracking-widest text-muted-foreground">
              About
            </span>
            <span className="font-[family-name:var(--font-inter)] text-sm font-light uppercase tracking-widest text-muted-foreground">
              Privacy
            </span>
            <span className="font-[family-name:var(--font-inter)] text-sm font-light uppercase tracking-widest text-muted-foreground">
              Terms
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-widest text-[#FFEABB]">
              London
            </span>
            <span className="size-1 rounded-full bg-background dark:bg-[#4F4632]" aria-hidden />
            <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-widest text-[#FFEABB]">
              San Francisco
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
