"use client";

import * as React from "react";

export type SidebarDynamicState = {
  complianceAttention: boolean;
  maintenanceAttention: boolean;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: string | null;
  subscriptionTrialEnd: string | null;
  pendingApprovalsCount: number;
  pendingApprovalsBadgeTitle: string | null;
};

const defaultState: SidebarDynamicState = {
  complianceAttention: false,
  maintenanceAttention: false,
  subscriptionPlan: null,
  subscriptionStatus: null,
  subscriptionPeriodEnd: null,
  subscriptionTrialEnd: null,
  pendingApprovalsCount: 0,
  pendingApprovalsBadgeTitle: null,
};

type SidebarDynamicContextValue = {
  state: SidebarDynamicState;
  merge: (patch: Partial<SidebarDynamicState>) => void;
};

const SidebarDynamicContext = React.createContext<SidebarDynamicContextValue | null>(null);

function patchChangesState(
  prev: SidebarDynamicState,
  patch: Partial<SidebarDynamicState>,
): SidebarDynamicState | null {
  let changed = false;
  const next: SidebarDynamicState = { ...prev };
  (Object.keys(patch) as (keyof SidebarDynamicState)[]).forEach((key) => {
    const v = patch[key];
    if (v === undefined) return;
    if (!Object.is(prev[key], v)) {
      Object.assign(next, { [key]: v } as Partial<SidebarDynamicState>);
      changed = true;
    }
  });
  return changed ? next : null;
}

/** Deterministic JSON so effect deps / dedupe are stable regardless of patch key order. */
export function stableSerializeSidebarPatch(patch: Partial<SidebarDynamicState>): string {
  const keys = (Object.keys(patch) as (keyof SidebarDynamicState)[])
    .filter((k) => patch[k] !== undefined)
    .sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) {
    ordered[k] = patch[k];
  }
  return JSON.stringify(ordered);
}

export function SidebarDynamicProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SidebarDynamicState>(defaultState);
  const merge = React.useCallback((patch: Partial<SidebarDynamicState>) => {
    setState((prev) => {
      const next = patchChangesState(prev, patch);
      return next ?? prev;
    });
  }, []);

  const value = React.useMemo(() => ({ state, merge }), [state, merge]);

  return <SidebarDynamicContext.Provider value={value}>{children}</SidebarDynamicContext.Provider>;
}

export function useSidebarDynamicOptional(): SidebarDynamicContextValue | null {
  return React.useContext(SidebarDynamicContext);
}

/** Applies streamed server data into sidebar context (no DOM output). */
export function SidebarPatch(patch: Partial<SidebarDynamicState>) {
  const merge = React.useContext(SidebarDynamicContext)?.merge;
  const serialized = React.useMemo(() => stableSerializeSidebarPatch(patch), [patch]);
  const lastMergedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!merge) return;
    if (lastMergedRef.current === serialized) return;
    lastMergedRef.current = serialized;
    merge(JSON.parse(serialized) as Partial<SidebarDynamicState>);
  }, [merge, serialized]);

  return null;
}
