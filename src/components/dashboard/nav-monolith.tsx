"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Building2, FileText, LayoutDashboard, LineChart, Users } from "lucide-react";

/** Stitch / legacy monolith nav — every label matches an existing App Router page. */
const items = [
  { title: "Command Center", url: "/dashboard", icon: LayoutDashboard },
  { title: "Portfolio", url: "/dashboard/properties", icon: Building2 },
  { title: "Tenants", url: "/dashboard/tenants", icon: Users },
  { title: "Contracts", url: "/dashboard/contracts", icon: FileText },
  { title: "Activity", url: "/dashboard/activity", icon: LineChart },
] as const;

export function NavMonolith() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.url === "/dashboard"
            ? pathname === "/dashboard" || pathname === "/dashboard/"
            : pathname === item.url || pathname.startsWith(`${item.url}/`);

        return (
          <Link
            key={item.title}
            href={item.url}
            className={cn(
              "flex items-center gap-3 rounded-[2px] px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-wider transition-colors duration-150",
              isActive
                ? "bg-white/[0.04] text-white"
                : "text-neutral-500 hover:bg-white/[0.02] hover:text-white",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
