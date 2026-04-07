"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutGrid, Search } from "lucide-react";

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
  { prefix: "/dashboard/agents", label: "Intelligence" },
  { prefix: "/dashboard/activity", label: "History" },
  { prefix: "/dashboard/assistant", label: "Assistant" },
  { prefix: "/dashboard/settings", label: "Settings" },
];

function breadcrumbFor(pathname: string): { parent: string; current: string } {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return { parent: "Dashboard", current: "Home" };
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
        "sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-[#484848]/15",
        "bg-[#0E0E0E]/60 backdrop-blur-xl transition-[width,height] ease-linear",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:h-16",
      )}
    >
      <div className="flex w-full items-center justify-between gap-4 px-4 lg:px-12">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SidebarTrigger className="-ml-1 text-[#ACABAA] hover:bg-[#1F2020] hover:text-[#BD9952] md:hidden" />
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="font-headline text-sm font-light text-[#ACABAA]">{parent}</span>
            <span className="text-[#484848]" aria-hidden>
              /
            </span>
            <span className="font-headline truncate text-sm font-light text-[#C9C6C5]">{current}</span>
          </div>
        </div>

        <div className="hidden max-w-md flex-1 justify-center px-4 md:flex">
          <label className="relative flex w-full max-w-sm items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-[#ACABAA]" aria-hidden />
            <input
              type="search"
              readOnly
              placeholder="Command + K to search…"
              className="w-full rounded-sm border-0 bg-[#131313] py-2 pl-10 pr-4 font-[family-name:var(--font-inter)] text-xs text-[#C9C6C5] placeholder:text-[#484848] focus:outline-none focus:ring-1 focus:ring-[#BD9952]"
              aria-label="Search (coming soon)"
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 text-[#ACABAA] hover:bg-transparent hover:text-[#BD9952]"
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
                className="size-9 text-[#ACABAA] hover:bg-transparent hover:text-[#BD9952]"
                aria-label="App shortcuts"
              >
                <LayoutGrid className="size-[18px] stroke-[1.25]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-[#484848]/20 bg-[#131313] text-[#E7E5E4]">
              <DropdownMenuLabel className="font-headline text-xs font-normal text-[#ACABAA]">
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
                <Link href="/dashboard/assistant">Assistant</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
