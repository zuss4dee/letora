import type { PropertyInspectorActivityEntry } from "@/app/(dashboard)/dashboard/properties/property-inspector-activity-display";

/** Serializable activity row for the tenancies registry inspector (same shape as property inspector). */
export type TenancyInspectorActivityEntry = PropertyInspectorActivityEntry;

export type TenancyOnboardingTaskDto = {
  id: string;
  taskName: string;
  taskType: string;
  status: "pending" | "complete" | "skipped";
  completedAt: string | null;
};

/** Per-tenancy checklist from `onboarding_tasks`; missing key or empty array means no rows in DB. */
export type TenancyOnboardingTasksByTenancyId = Record<string, TenancyOnboardingTaskDto[]>;

/** Date + time for activity rows (tenancies span multiple days; clock-only is ambiguous). */
export function formatTenancyInspectorWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

export function humanizeTenancyOnboardingStatus(status: string | null | undefined): string {
  if (!status?.trim()) return "Not set";
  const s = status.trim().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function rightToRentLabel(status: string | null | undefined): { label: string; passed: boolean } {
  const normalized = (status ?? "").toLowerCase().trim();
  if (normalized === "verified" || normalized === "passed" || normalized === "complete") {
    return { label: "PASSED", passed: true };
  }
  if (!normalized || normalized === "pending") {
    return { label: "PENDING", passed: false };
  }
  return { label: normalized.toUpperCase(), passed: false };
}
