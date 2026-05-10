"use client";

import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const crumbMap: { prefix: string; label: string }[] = [
  { prefix: "/dashboard/properties", label: "Portfolio" },
  { prefix: "/dashboard/tenants", label: "Tenants" },
  { prefix: "/dashboard/tenancies", label: "Tenancies" },
  { prefix: "/dashboard/rent-tracker", label: "Rent Tracker" },
  { prefix: "/dashboard/maintenance", label: "Maintenance" },
  { prefix: "/dashboard/compliance", label: "Compliance" },
  { prefix: "/dashboard/contracts", label: "Contracts" },
  { prefix: "/dashboard/emails", label: "Emails" },
  { prefix: "/dashboard/import", label: "Portfolio Import" },
  { prefix: "/dashboard/agents", label: "Agents" },
  { prefix: "/dashboard/activity", label: "Activity" },
  { prefix: "/dashboard/approvals", label: "Approvals" },
  { prefix: "/dashboard/billing", label: "Billing" },
  { prefix: "/dashboard/settings", label: "Settings" },
];

function breadcrumbFor(pathname: string): { current: string } {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return { current: "Command Center" };
  }
  if (pathname === "/dashboard/tenants" || pathname === "/dashboard/tenants/") {
    return { current: "Tenant Registry" };
  }
  if (pathname.startsWith("/dashboard/tenants/")) {
    return { current: "Tenant" };
  }
  if (pathname === "/dashboard/properties" || pathname === "/dashboard/properties/") {
    return { current: "Portfolio Overview" };
  }
  if (pathname.startsWith("/dashboard/properties/")) {
    return { current: "Property" };
  }
  if (pathname === "/dashboard/maintenance" || pathname === "/dashboard/maintenance/") {
    return { current: "Maintenance Intelligence" };
  }
  if (pathname === "/dashboard/compliance" || pathname === "/dashboard/compliance/") {
    return { current: "Compliance" };
  }
  if (pathname === "/dashboard/tenancies" || pathname === "/dashboard/tenancies/") {
    return { current: "Tenancies" };
  }
  if (pathname.startsWith("/dashboard/tenancies/")) {
    return { current: "Tenancy" };
  }
  if (pathname === "/dashboard/rent-tracker" || pathname === "/dashboard/rent-tracker/") {
    return { current: "Rent Tracker" };
  }
  if (pathname === "/dashboard/leads" || pathname === "/dashboard/leads/") {
    return { current: "Lead Management" };
  }
  if (pathname === "/dashboard/emails" || pathname === "/dashboard/emails/") {
    return { current: "Emails Sent" };
  }
  const hit = crumbMap.find((c) => pathname === c.prefix || pathname.startsWith(`${c.prefix}/`));
  if (hit) {
    return { current: hit.label };
  }
  return { current: "Home" };
}

/** Mobile / tablet strip (< lg): opens the sidebar drawer. Hidden on large desktops. */
export function DashboardMobileInsetBar() {
  const pathname = usePathname();
  const { current } = breadcrumbFor(pathname ?? "");

  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-background px-4 lg:hidden",
        "dark:bg-[#0b0b0b]",
      )}
    >
      <SidebarTrigger className="-ml-1 min-h-11 min-w-11 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white" />
      <span className="font-headline min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {current}
      </span>
    </div>
  );
}
