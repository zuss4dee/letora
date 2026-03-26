"use client";

import { createContext, useContext } from "react";

const SubscriptionPlanContext = createContext<string | null>(null);

export function SubscriptionPlanProvider({
  plan,
  children,
}: {
  plan: string | null;
  children: React.ReactNode;
}) {
  return (
    <SubscriptionPlanContext.Provider value={plan}>
      {children}
    </SubscriptionPlanContext.Provider>
  );
}

export function useSubscriptionPlan() {
  return useContext(SubscriptionPlanContext);
}

