"use client";

import { Bell, Plus } from "lucide-react";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const titleByPrefix: Array<{ prefix: string; title: string }> = [
  { prefix: "/dashboard/properties", title: "Properties" },
  { prefix: "/dashboard/tenants", title: "Tenants" },
  { prefix: "/dashboard/tenancies", title: "Tenancies" },
  { prefix: "/dashboard/rent-tracker", title: "Rent Tracker" },
  { prefix: "/dashboard/maintenance", title: "Maintenance" },
  { prefix: "/dashboard/contracts", title: "Contracts" },
  { prefix: "/dashboard/leads", title: "Leads" },
  { prefix: "/dashboard", title: "Dashboard" },
];

function getTitle(pathname: string) {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return "Dashboard";
  const sorted = [...titleByPrefix].sort((a, b) => b.prefix.length - a.prefix.length);
  return sorted.find((t) => pathname.startsWith(t.prefix))?.title ?? "Dashboard";
}

export function Header() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-full bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Quick Create
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-50"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

