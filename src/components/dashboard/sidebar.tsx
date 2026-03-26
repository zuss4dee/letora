"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Users,
  UserPlus,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", href: "/dashboard/properties", icon: Building2 },
  { label: "Tenants", href: "/dashboard/tenants", icon: Users },
  { label: "Rent Tracker", href: "/dashboard/rent", icon: CircleDollarSign },
  { label: "Maintenance", href: "/dashboard/maintenance", icon: Wrench },
  { label: "Contracts", href: "/dashboard/contracts", icon: FileText },
  { label: "Leads", href: "/dashboard/leads", icon: UserPlus },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function onLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-dvh w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-5 pt-5">
        <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Letora
        </div>
      </div>

      <div className="px-4 pt-4">
        <Separator className="bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <div className="px-5 pt-4 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Navigation
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100",
                isActive &&
                  "bg-indigo-50 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-200",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-4">
        <Separator className="bg-zinc-200 dark:bg-zinc-800" />
        <Button
          type="button"
          variant="outline"
          onClick={onLogout}
          className="mt-4 w-full justify-start gap-2 border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-50"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>
    </aside>
  );
}

