import type { Metadata } from "next";

import { LetoraLanding } from "@/components/marketing/letora-landing";

export const metadata: Metadata = {
  title: "Letora: Property Operating System for UK landlords",
  description:
    "One workspace for leads, rent, tenancies, and maintenance. Built for UK landlords who want calm operations instead of scattered tools.",
  openGraph: {
    title: "Letora: Property Operating System",
    description:
      "Qualify leads, chase rent, run tenancies, and triage maintenance from one command surface.",
  },
};

export default function HomePage() {
  return <LetoraLanding />;
}
