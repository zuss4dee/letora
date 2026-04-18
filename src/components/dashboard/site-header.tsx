"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutGrid } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const { parent, current } = breadcrumbFor(pathname ?? "");

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-border/80",
        "bg-background/85 backdrop-blur-xl transition-[width,height] ease-linear dark:bg-background/60",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:h-16",
      )}
    >
      <div className="flex w-full items-center justify-between gap-4 px-4 lg:px-12">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:bg-accent hover:text-secondary md:hidden" />
          <span className="font-headline truncate text-sm font-light text-foreground md:hidden">{current}</span>
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="font-headline text-sm font-light text-muted-foreground">{parent}</span>
            <span className="text-muted-foreground" aria-hidden>
              /
            </span>
            <span className="font-headline truncate text-sm font-light text-foreground">{current}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground hover:bg-transparent hover:text-[#BD9952]"
            aria-label="Notifications"
          >
            <Bell className="size-[18px] stroke-[1.25]" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-muted-foreground hover:bg-transparent hover:text-[#BD9952]"
                aria-label="App shortcuts"
              >
                <LayoutGrid className="size-[18px] stroke-[1.25]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-border bg-popover text-popover-foreground">
              <DropdownMenuLabel className="font-headline text-xs font-normal text-muted-foreground">
                Jump to
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem asChild className="focus:bg-accent">
                <Link href="/dashboard/leads">Leads inbox</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-accent">
                <Link href="/dashboard/emails">Emails</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-accent">
                <Link href="/dashboard/rent-tracker">Rent tracker</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-accent">
                <Link href="/dashboard">Home</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
