import type { Metadata } from "next";
import Link from "next/link";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { LetoraPricingSection } from "@/components/marketing/letora-pricing";

export const metadata: Metadata = {
  title: "Pricing · Letora",
  description:
    "Starter, Pro, and Portfolio plans for UK landlords. Self-serve monthly billing in GBP. Enterprise for larger portfolios.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#131313] text-foreground">
      <MarketingHeader />
      <div
        className="h-[calc(3.75rem+env(safe-area-inset-top,0px))] shrink-0 sm:h-[calc(4rem+env(safe-area-inset-top,0px))]"
        aria-hidden
      />
      <LetoraPricingSection />
      <footer className="border-t border-[#4F4632]/10 px-6 py-10 text-center md:px-12 lg:px-24">
        <Link
          href="/"
          className="font-[family-name:var(--font-inter)] text-sm font-medium text-muted-foreground transition-colors hover:text-[#FFEABB]"
        >
          ← Back to home
        </Link>
      </footer>
    </div>
  );
}
