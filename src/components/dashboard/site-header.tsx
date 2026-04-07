"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutGrid, Search } from "lucide-react";

import { useOpenCommandPalette } from "@/components/dashboard/dashboard-command-palette";
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
  { prefix: "/dashboard/contracts", label: "Contracts" },
  { prefix: "/dashboard/emails", label: "Emails" },
  { prefix: "/dashboard/leads", label: "Leads" },
  { prefix: "/dashboard/agents", label: "Agents" },
  { prefix: "/dashboard/activity", label: "History" },
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
  const { openPalette } = useOpenCommandPalette();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-[#484848]/15",
        "bg-[#0E0E0E]/60 backdrop-blur-xl transition-[width,height] ease-linear",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:h-16",
      )}
    >
      <div className="flex w-full items-center justify-between gap-4 px-4 lg:px-12">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:bg-[#1F2020] hover:text-[#BD9952] md:hidden" />
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="font-headline text-sm font-light text-muted-foreground">{parent}</span>
            <span className="text-[#484848]" aria-hidden>
              /
            </span>
            <span className="font-headline truncate text-sm font-light text-foreground">{current}</span>
          </div>
        </div>

        <div className="hidden max-w-md flex-1 justify-center px-4 md:flex">
          <button
            type="button"
            onClick={() => openPalette()}
            className="relative flex w-full max-w-sm cursor-pointer items-center rounded-sm border-0 bg-[#131313] py-2 pl-10 pr-4 text-left font-[family-name:var(--font-inter)] text-xs text-muted-foreground transition-colors hover:bg-[#1a1a1a] hover:text-foreground focus:outline-none focus:ring-1 focus:ring-[#BD9952]"
            aria-label="Open command palette"
          >
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
            <span className="text-[#484848]">Search or run an agent…</span>
            <kbd className="pointer-events-none ml-auto hidden items-center gap-0.5 rounded border border-[#484848]/40 bg-[#0E0E0E] px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground sm:inline-flex">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden size-9 text-muted-foreground hover:bg-transparent hover:text-[#BD9952]"
            aria-label="Open command palette"
            onClick={() => openPalette()}
          >
            <Search className="size-[18px] stroke-[1.25]" />
          </Button>
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
            <DropdownMenuContent align="end" className="w-56 border-[#484848]/20 bg-[#131313] text-foreground">
              <DropdownMenuLabel className="font-headline text-xs font-normal text-muted-foreground">
                Jump to
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#484848]/20" />
              <DropdownMenuItem asChild className="focus:bg-[#1F2020]">
                <Link href="/dashboard/leads">Leads inbox</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-[#1F2020]">
                <Link href="/dashboard/emails">Emails</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-[#1F2020]">
                <Link href="/dashboard/rent-tracker">Rent tracker</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="focus:bg-[#1F2020]">
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
