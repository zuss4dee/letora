"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Command, Search, UserCircle2 } from "lucide-react";

import { useOpenCommandPalette } from "@/components/dashboard/dashboard-command-palette";
import { Button } from "@/components/ui/button";
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

function breadcrumbFor(pathname: string): { parent: string; current: string } {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return { parent: "Dashboard", current: "Home" };
  }
  if (pathname === "/dashboard/tenants" || pathname === "/dashboard/tenants/") {
    return { parent: "Management Console", current: "Tenant Registry" };
  }
  if (pathname.startsWith("/dashboard/tenants/")) {
    return { parent: "Management Console", current: "Tenant" };
  }
  if (pathname === "/dashboard/properties" || pathname === "/dashboard/properties/") {
    return { parent: "Architecture & Portfolio", current: "Managed Properties" };
  }
  if (pathname.startsWith("/dashboard/properties/")) {
    return { parent: "Architecture & Portfolio", current: "Property" };
  }
  if (pathname === "/dashboard/maintenance" || pathname === "/dashboard/maintenance/") {
    return { parent: "Operational Console", current: "Maintenance Intelligence" };
  }
  if (pathname === "/dashboard/compliance" || pathname === "/dashboard/compliance/") {
    return { parent: "Operational Console", current: "Compliance" };
  }
  if (pathname === "/dashboard/tenancies" || pathname === "/dashboard/tenancies/") {
    return { parent: "Portfolio", current: "Tenancies" };
  }
  if (pathname.startsWith("/dashboard/tenancies/")) {
    return { parent: "Portfolio", current: "Tenancy" };
  }
  if (pathname === "/dashboard/rent-tracker" || pathname === "/dashboard/rent-tracker/") {
    return { parent: "Portfolio", current: "Rent Tracker" };
  }
  if (pathname === "/dashboard/leads" || pathname === "/dashboard/leads/") {
    return { parent: "Portfolio", current: "Lead Management" };
  }
  if (pathname === "/dashboard/emails" || pathname === "/dashboard/emails/") {
    return { parent: "Portfolio", current: "Emails Sent" };
  }
  const hit = crumbMap.find((c) => pathname === c.prefix || pathname.startsWith(`${c.prefix}/`));
  if (hit) {
    return { parent: "Dashboard", current: hit.label };
  }
  return { parent: "Dashboard", current: "Home" };
}

export function SiteHeader() {
  const pathname = usePathname();
  const { current } = breadcrumbFor(pathname ?? "");
  const { openPalette } = useOpenCommandPalette();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-12 shrink-0 items-center border-b border-border/80",
        "bg-[#0b0b0b] transition-[width,height] ease-linear",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:h-16",
      )}
    >
      <div className="flex w-full items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SidebarTrigger className="-ml-1 text-zinc-400 hover:bg-transparent hover:text-white md:hidden" />
          <div className="relative hidden w-full max-w-md md:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              readOnly
              onClick={openPalette}
              aria-label="Search or open command palette"
              className="h-8 w-full border border-border bg-black pl-8 pr-3 text-xs text-zinc-200 outline-none"
              value="Search or CMD+K"
            />
          </div>
          <span className="font-headline truncate text-sm font-light text-foreground md:hidden">{current}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-zinc-500 hover:bg-transparent hover:text-white"
            aria-label="Notifications"
          >
            <Bell className="size-[18px] stroke-[1.25]" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-zinc-500 hover:bg-transparent hover:text-white"
            aria-label="Command palette"
            onClick={openPalette}
          >
            <Command className="size-[18px] stroke-[1.25]" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-zinc-500 hover:bg-transparent hover:text-white"
            aria-label="Profile"
            asChild
          >
            <Link href="/dashboard/settings">
              <UserCircle2 className="size-[18px] stroke-[1.25]" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
