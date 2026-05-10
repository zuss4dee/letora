export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { LetoraPricingSection } from "@/components/marketing/letora-pricing";

export const metadata: Metadata = {
  title: "Pricing · Letora",
  description:
    "Letora for UK landlords — monthly or yearly subscription. Full agent layer, portfolio import, and rent operations. Enterprise for larger teams.",
};

export default function PricingPage() {
  return (
    <div className="dark min-h-screen bg-background dark:bg-[#131313] text-foreground">
      <MarketingHeader />
      <div
        className="h-[calc(3.75rem+env(safe-area-inset-top,0px))] shrink-0 sm:h-[calc(4rem+env(safe-area-inset-top,0px))]"
        aria-hidden
      />
      <LetoraPricingSection />
      <footer className="border-t border-border dark:border-[#4F4632]/10 px-6 py-10 text-center md:px-12 lg:px-24">
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
