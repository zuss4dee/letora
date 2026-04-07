import type { Metadata } from "next";
import Link from "next/link";

import { LetoraPricingSection } from "@/components/marketing/letora-pricing";

export const metadata: Metadata = {
  title: "Pricing · Letora",
  description:
    "Starter, Pro, and Portfolio plans for UK landlords. Self-serve monthly billing in GBP. Enterprise for larger portfolios.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#131313] text-[#E2E2E2]">
      <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[#4F4632]/10 bg-[#131313]/85 px-6 backdrop-blur-md md:px-12 lg:px-24">
        <Link href="/" className="font-headline text-xl font-semibold tracking-[-0.04em] text-[#E2E2E2]">
          Letora
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="font-[family-name:var(--font-inter)] text-sm font-semibold tracking-tight text-[#FFEABB] transition-opacity hover:opacity-80"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md bg-gradient-to-br from-[#FFEABB] to-[#FFC800] px-5 py-2.5 text-sm font-semibold text-[#3e2e00] shadow-[0_0_32px_-10px_rgba(255,234,187,0.35)] transition-all hover:shadow-[0_0_48px_-8px_rgba(255,234,187,0.5)]"
          >
            Get started
          </Link>
        </div>
      </header>
      <LetoraPricingSection />
      <footer className="border-t border-[#4F4632]/10 px-6 py-10 text-center md:px-12 lg:px-24">
        <Link
          href="/"
          className="font-[family-name:var(--font-inter)] text-sm font-medium text-[#ACABAA] transition-colors hover:text-[#FFEABB]"
        >
          ← Back to home
        </Link>
      </footer>
    </div>
  );
}
