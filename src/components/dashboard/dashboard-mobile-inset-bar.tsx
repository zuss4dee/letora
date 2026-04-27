"use client";

import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const crumbMap: { prefix: string; label: string }[] = [
  { prefix: "/dashboard/properties", label: "Properties" },
  { prefix: "/dashboard/tenants", label: "Tenants" },
  { prefix: "/dashboard/tenancies", label: "Tenancies" },
  { prefix: "/dashboard/rent-tracker", label: "Rent Tracker" },
  { prefix: "/dashboard/maintenance", label: "Maintenance" },
  { prefix: "/dashboard/compliance", label: "Compliance" },
  { prefix: "/dashboard/contracts", label: "Contracts" },
  { prefix: "/dashboard/emails", label: "Emails" },
  { prefix: "/dashboard/leads", label: "Leads" },
  { prefix: "/dashboard/import", label: "Import" },
  { prefix: "/dashboard/agents", label: "Agents" },
  { prefix: "/dashboard/activity", label: "History" },
  { prefix: "/dashboard/billing", label: "Billing" },
  { prefix: "/dashboard/help", label: "Help" },
  { prefix: "/dashboard/settings", label: "Settings" },
];

function breadcrumbFor(pathname: string): { current: string } {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return { current: "Home" };
  }
  if (pathname === "/dashboard/tenants" || pathname === "/dashboard/tenants/") {
    return { current: "Tenant Registry" };
  }
  if (pathname.startsWith("/dashboard/tenants/")) {
    return { current: "Tenant" };
  }
  if (pathname === "/dashboard/properties" || pathname === "/dashboard/properties/") {
    return { current: "Managed Properties" };
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

/** Mobile-only strip: opens the sidebar; not sticky (replaces removed SiteHeader chrome). */
export function DashboardMobileInsetBar() {
  const pathname = usePathname();
  const { current } = breadcrumbFor(pathname ?? "");

  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 border-b border-border/80 bg-background px-4 md:hidden",
        "dark:bg-[#0b0b0b]",
      )}
    >
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:bg-transparent hover:text-foreground dark:text-zinc-400 dark:hover:text-white" />
      <span className="font-headline min-w-0 flex-1 truncate text-sm font-light text-foreground">{current}</span>
    </div>
  );
}
