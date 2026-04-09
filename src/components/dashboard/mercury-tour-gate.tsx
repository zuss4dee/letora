"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { useState, useCallback } from "react";

import { MercuryProductTour } from "@/components/dashboard/mercury-product-tour";

/**
 * Launches the Mercury tour only on the dashboard home (assistant landing),
 * when `has_seen_tour` is false. Chat view (`?c=`) skips the tour so targets exist.
 */
export function MercuryTourGate({ initialShowTour }: { initialShowTour: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");
  const isDashboardHome = pathname === "/dashboard" || pathname === "/dashboard/";
  const isAssistantLanding = isDashboardHome && !conversationId;
  const [dismissedLocal, setDismissedLocal] = useState(false);

  const active = initialShowTour && isAssistantLanding && !dismissedLocal;

  const onDismissed = useCallback(() => {
    setDismissedLocal(true);
  }, []);

  return <MercuryProductTour active={active} onDismissed={onDismissed} />;
}
