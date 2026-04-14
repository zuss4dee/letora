import { isPayingPlatformSubscription } from "@/lib/plan-limits";

export type SubscriptionFields = {
  subscriptionPlan: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  subscriptionPeriodEnd: string | null | undefined;
  subscriptionTrialEnd: string | null | undefined;
};

export function getPlanDisplayName(fields: SubscriptionFields): string {
  const paying = isPayingPlatformSubscription(fields.subscriptionStatus);
  const name = fields.subscriptionPlan?.trim();
  if (paying && name) return name;
  if (paying && !name) return "Paid plan";
  return "Starter";
}

export function subscriptionStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return "No subscription";
  const s = status.toLowerCase();
  const map: Record<string, string> = {
    trialing: "Trial",
    active: "Active",
    past_due: "Past due",
    canceled: "Canceled",
    cancelled: "Canceled",
    incomplete: "Incomplete",
    incomplete_expired: "Incomplete (expired)",
    unpaid: "Unpaid",
    paused: "Paused",
    inactive: "Inactive",
  };
  return map[s] ?? status;
}

/** One line for sidebar: "Starter — Trial", "Pro — Active", "Starter — Free". */
export function getSidebarPlanStatusCompact(fields: SubscriptionFields): string {
  const planName = getPlanDisplayName(fields);
  const st = fields.subscriptionStatus?.toLowerCase() ?? "";
  if (st === "trialing") return `${planName} — Trial`;
  if (st === "active") return `${planName} — Active`;
  if (st === "past_due") return `${planName} — Past due`;
  if (isPayingPlatformSubscription(fields.subscriptionStatus)) {
    const tail = subscriptionStatusLabel(fields.subscriptionStatus);
    return `${planName} — ${tail}`;
  }
  return `${planName} — Free`;
}

export function formatSubscriptionDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
