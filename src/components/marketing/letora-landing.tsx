"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
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
        "inline-flex items-center justify-center rounded-md bg-gradient-to-br from-[#FFEABB] to-[#FFC800] font-semibold text-[#3e2e00] shadow-[0_0_40px_-10px_rgba(255,234,187,0.35)] transition-all hover:shadow-[0_0_56px_-8px_rgba(255,234,187,0.55)] active:scale-[0.98]",
        size === "lg" ? "px-10 py-5 text-lg" : "px-6 py-2.5 text-sm",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={cn(
        "font-[family-name:var(--font-inter)] text-xs font-semibold tracking-tight transition-opacity md:text-[0.8125rem] xl:text-sm",
        active ? "text-[#FFEABB] opacity-100" : "text-[#E2E2E2]/80 hover:opacity-100",
        "whitespace-nowrap",
      )}
    >
      {children}
    </a>
  );
}

export function LetoraLanding() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#131313] text-[#E2E2E2] selection:bg-[#FFEABB]/35 selection:text-[#1a1200]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[#FFEABB] focus:px-4 focus:py-2 focus:text-[#3e2e00]"
      >
        Skip to content
      </a>

      <nav
        className="fixed left-0 top-0 z-50 flex h-16 w-full min-w-0 items-center justify-between gap-3 border-b border-[#4F4632]/10 bg-[#131313]/70 px-4 backdrop-blur-md sm:px-6 md:px-8 lg:px-16 xl:px-24"
        aria-label="Primary"
      >
        <Link href="/" className="group flex min-w-0 shrink-0 flex-col leading-none">
          <span className="font-headline text-lg font-semibold tracking-[-0.04em] text-[#E2E2E2] transition-colors group-hover:text-white sm:text-xl">
            Letora
          </span>
          <span className="mt-0.5 hidden font-[family-name:var(--font-inter)] text-[0.55rem] font-medium uppercase tracking-[0.28em] text-[#d2c5ab]/70 sm:block">
            Property OS
          </span>
        </Link>
        <div className="hidden min-w-0 flex-1 items-center justify-center gap-x-2 md:flex md:gap-x-3 lg:gap-x-5 xl:gap-x-8">
          <NavLink href="/" active>
            Home
          </NavLink>
          <NavLink href="#lead-intelligence">Leads</NavLink>
          <NavLink href="#rent-chasing">Rent</NavLink>
          <NavLink href="#ai-operations">Workspace</NavLink>
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#pricing">Pricing</NavLink>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4 md:gap-6">
          <Link
            href="/login"
            className="font-[family-name:var(--font-inter)] text-sm font-semibold tracking-tight text-[#FFEABB] transition-opacity hover:opacity-80"
          >
            Log in
          </Link>
          <JewelryButton href="/signup" size="md" className="!px-4 !py-2 text-xs sm:!px-6 sm:!py-2.5 sm:text-sm">
            Get started
          </JewelryButton>
        </div>
      </nav>

      <main id="main">
        {/* Hero */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16 text-center">
          <div className="pointer-events-none absolute inset-0 z-0 opacity-100">
            <div className="absolute left-1/2 top-[42%] h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_55%_45%_at_50%_50%,rgba(226,226,226,0.07)_0%,transparent_62%)]" />
            <div className="absolute left-1/2 top-1/2 h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle_at_center,rgba(100,118,132,0.045)_0%,transparent_58%)]" />
          </div>
          <div className="relative z-10 max-w-5xl space-y-10 md:space-y-12">
            <h1 className="space-y-3 md:space-y-5">
              <span className="block bg-gradient-to-br from-[#FFEABB] via-[#FFEABB] to-[#FFC800] bg-clip-text font-headline text-6xl font-extrabold leading-[0.92] tracking-[-0.04em] text-transparent md:text-8xl lg:text-9xl">
                Letora
              </span>
              <span className="block font-headline text-3xl font-light leading-tight tracking-[-0.03em] text-[#E2E2E2] md:text-5xl lg:text-6xl">
                Property Operating System
              </span>
            </h1>
            <p className="mx-auto max-w-xl font-[family-name:var(--font-inter)] text-lg font-light leading-relaxed text-[#d2c5ab] md:text-xl">
              One calm surface for UK landlords: leads, rent, tenancies, and maintenance. You approve what goes
              out.
            </p>
            <div className="pt-4">
              <JewelryButton href="/signup" size="lg">
                Create your Letora account
              </JewelryButton>
            </div>
          </div>
          <a
            href="#lead-intelligence"
            className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 text-[#E2E2E2]/40 transition-colors hover:text-[#FFEABB]/80"
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
          className="scroll-mt-24 bg-[#1b1b1b] px-6 py-24 md:px-12 lg:px-24 lg:py-32"
        >
          <div className="mx-auto grid max-w-screen-2xl grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-20">
            <div className="z-10 space-y-8">
              <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.2em] text-[#FFEABB]">
                Adaptive AI
              </span>
              <h2 className="font-headline text-5xl font-bold leading-[0.9] tracking-[-0.04em] text-[#E2E2E2] md:text-7xl">
                Lead
                <br />
                Intelligence
              </h2>
              <p className="max-w-md font-[family-name:var(--font-inter)] text-lg font-light leading-relaxed text-[#d2c5ab] md:text-xl">
                See intent before the first reply. Letora scores and qualifies leads from your pipeline so
                your team spends time on tenancies that convert, not on noise.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <span className="h-px w-12 bg-[#4F4632]/40" aria-hidden />
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-sm font-semibold uppercase tracking-widest text-[#FFEABB] transition-transform hover:translate-x-1"
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
          className="scroll-mt-24 bg-[#131313] px-6 py-24 md:px-12 lg:px-24 lg:py-32"
        >
          <div className="mx-auto flex max-w-screen-2xl flex-col items-center gap-16 lg:flex-row-reverse lg:gap-16">
            <div className="space-y-8 text-right lg:w-1/2">
              <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.2em] text-[#FFEABB]">
                Efficiency
              </span>
              <h2 className="font-headline text-5xl font-bold leading-[0.9] tracking-[-0.04em] text-[#E2E2E2] md:text-7xl">
                Automated
                <br />
                Rent chasing
              </h2>
              <div className="flex justify-end">
                <p className="max-w-md font-[family-name:var(--font-inter)] text-lg font-light leading-relaxed text-[#d2c5ab] md:text-xl">
                  Stop chasing spreadsheets. Rent Chaser sends firm, professional follow-ups on your schedule,
                  with drafts you can approve before anything goes out.
                </p>
              </div>
            </div>
            <div className="relative w-full lg:w-1/2">
              <div className="absolute -left-8 top-0 h-64 w-64 rounded-full bg-[#FFEABB]/5 blur-3xl" aria-hidden />
              <div className="relative z-20 mx-auto max-w-lg translate-y-0 rounded-2xl border border-[#4F4632]/15 bg-[rgba(53,53,53,0.35)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:ml-0 lg:translate-y-10">
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex gap-2">
                    <div className="size-2 rounded-full bg-red-400/40" />
                    <div className="size-2 rounded-full bg-[#FFEABB]/40" />
                    <div className="size-2 rounded-full bg-[#c5c5d8]/40" />
                  </div>
                  <span className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest opacity-40">
                    System active
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-[#1b1b1b] p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-full bg-[#FFEABB]/10">
                        <span className="text-sm text-[#FFEABB]">£</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#E2E2E2]">Pending remittance</div>
                        <div className="font-[family-name:var(--font-inter)] text-[10px] text-[#d2c5ab]/70">
                          Unit 402 · £2,450.00
                        </div>
                      </div>
                    </div>
                    <span className="rounded bg-[#FFEABB]/20 px-2 py-1 font-[family-name:var(--font-inter)] text-[10px] text-[#FFEABB]">
                      Queued
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[#4F4632]/10 bg-[#1b1b1b]/60 p-4 opacity-70">
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 items-center justify-center rounded-full bg-[#c5c5d8]/10">
                        <span className="text-xs text-[#c5c5d8]">✓</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#E2E2E2]">Settled</div>
                        <div className="font-[family-name:var(--font-inter)] text-[10px] text-[#d2c5ab]/70">
                          Unit 115 · £1,800.00
                        </div>
                      </div>
                    </div>
                    <span className="rounded border border-[#4F4632]/30 px-2 py-1 font-[family-name:var(--font-inter)] text-[10px]">
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
          className="scroll-mt-24 bg-[#0e0e0e] px-6 py-24 md:px-12 lg:px-24 lg:py-32"
        >
          <div className="mx-auto max-w-4xl space-y-16 text-center">
            <div className="space-y-6">
              <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.2em] text-[#FFEABB]">
                Core engine
              </span>
              <h2 className="font-headline text-5xl font-bold leading-none tracking-[-0.04em] text-[#E2E2E2] md:text-7xl lg:text-8xl">
                AI-first
                <br />
                Operations
              </h2>
              <p className="mx-auto max-w-2xl pt-4 font-[family-name:var(--font-inter)] text-lg font-light leading-relaxed text-[#d2c5ab] md:text-2xl">
                Not another add-on chatbot. Letora is an operator layer across email, tenancies, maintenance,
                and contracts, with a single place to see what needs attention today.
              </p>
            </div>

            <div className="group relative cursor-default">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#FFEABB]/20 to-[#c5c5d8]/20 opacity-25 blur transition duration-700 group-hover:opacity-45" />
              <div className="relative overflow-hidden rounded-2xl border border-[#4F4632]/10">
                <div className="relative aspect-video w-full">
                  <Image
                    src={IMG_GLOBE}
                    alt="Glowing digital globe suggesting connected operations"
                    fill
                    className="object-cover brightness-[0.45] transition-all duration-700 group-hover:brightness-[0.58]"
                    sizes="(max-width: 896px) 100vw, 896px"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#353535]/50 px-6 py-3 backdrop-blur-md">
                      <span className="size-2 animate-pulse rounded-full bg-[#FFEABB]" />
                      <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-[0.25em] text-[#FFEABB]">
                        Live sync
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-12 pt-8 text-left md:grid-cols-3 md:gap-10">
              <div className="space-y-3">
                <div className="font-headline text-3xl font-bold tracking-tighter text-[#E2E2E2]">99.9%</div>
                <div className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#d2c5ab]/60">
                  Uptime target
                </div>
                <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-[#d2c5ab]">
                  Infrastructure built for always-on property operations, not demo-day uptime.
                </p>
              </div>
              <div className="space-y-3">
                <div className="font-headline text-3xl font-bold tracking-tighter text-[#E2E2E2]">&lt;15s</div>
                <div className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#d2c5ab]/60">
                  Typical reply path
                </div>
                <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-[#d2c5ab]">
                  Drafts and agent responses surface fast enough to feel like a live desk, without the desk.
                </p>
              </div>
              <div className="space-y-3">
                <div className="font-headline text-3xl font-bold tracking-tighter text-[#E2E2E2]">∞</div>
                <div className="font-[family-name:var(--font-inter)] text-[10px] uppercase tracking-widest text-[#d2c5ab]/60">
                  Portfolio scale
                </div>
                <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-[#d2c5ab]">
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
        <footer className="flex flex-col items-center justify-between gap-10 border-t border-[#4F4632]/10 bg-[#131313] px-6 py-16 md:flex-row md:px-12 lg:px-24">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <span className="font-headline text-xl font-semibold tracking-[-0.04em] text-[#E2E2E2]">Letora</span>
            <p className="font-[family-name:var(--font-inter)] text-[10px] font-light uppercase tracking-[0.2em] text-[#E2E2E2]/40">
              © {new Date().getFullYear()} Letora. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-10">
            <span className="font-[family-name:var(--font-inter)] text-sm font-light uppercase tracking-widest text-[#E2E2E2]/40">
              About
            </span>
            <span className="font-[family-name:var(--font-inter)] text-sm font-light uppercase tracking-widest text-[#E2E2E2]/40">
              Privacy
            </span>
            <span className="font-[family-name:var(--font-inter)] text-sm font-light uppercase tracking-widest text-[#E2E2E2]/40">
              Terms
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-widest text-[#FFEABB]">
              London
            </span>
            <span className="size-1 rounded-full bg-[#4F4632]" aria-hidden />
            <span className="font-[family-name:var(--font-inter)] text-xs font-bold uppercase tracking-widest text-[#FFEABB]">
              San Francisco
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
