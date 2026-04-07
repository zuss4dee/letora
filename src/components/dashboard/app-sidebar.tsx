"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  Building2,
  CircleDollarSign,
  FileText,
  HelpCircle,
  History,
  Home,
  Key,
  LogOut,
  Mail,
  MessageSquare,
  PlusCircle,
  Settings,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/client";

type NavItem = { title: string; url: string; icon: React.ElementType };

const mainItems: NavItem[] = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Tenants", url: "/dashboard/tenants", icon: Users },
  { title: "Properties", url: "/dashboard/properties", icon: Building2 },
];

const workflowItems: NavItem[] = [
  { title: "Contracts", url: "/dashboard/contracts", icon: FileText },
  { title: "Maintenance", url: "/dashboard/maintenance", icon: Wrench },
  { title: "Intelligence", url: "/dashboard/agents", icon: Bot },
  { title: "History", url: "/dashboard/activity", icon: History },
];

const moreItems: NavItem[] = [
  { title: "Tenancies", url: "/dashboard/tenancies", icon: Key },
  { title: "Rent Tracker", url: "/dashboard/rent-tracker", icon: CircleDollarSign },
  { title: "Emails", url: "/dashboard/emails", icon: Mail },
  { title: "Leads", url: "/dashboard/leads", icon: UserPlus },
  { title: "Assistant", url: "/dashboard/assistant", icon: MessageSquare },
];

function isActivePath(pathname: string, url: string) {
  if (url === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="mb-4">
      <span className="mb-2 block px-4 font-[family-name:var(--font-inter)] text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-[#ACABAA]">
        {label}
      </span>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.url);
          const Icon = item.icon;
          return (
            <li key={item.url}>
              <Link
                href={item.url}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] transition-colors duration-300",
                  active
                    ? "border-l-2 border-[#BD9952] bg-[#2C2C2C] text-[#C9C6C5]"
                    : "border-l-2 border-transparent text-[#ACABAA] hover:bg-[#1F2020] hover:text-[#C9C6C5]",
                )}
              >
                <Icon className="size-5 shrink-0 stroke-[1.25]" aria-hidden />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AppSidebar({
  userEmail,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function onLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="sidebar"
      className="border-[#484848]/15 [&_[data-sidebar=sidebar]]:border-[#484848]/15"
      {...props}
    >
      <SidebarHeader className="gap-0 px-4 pb-8 pt-8">
        <Link href="/dashboard" className="block px-2">
          <span className="font-headline text-lg font-light tracking-[0.2em] text-[#C9C6C5]">
            LETORA
          </span>
          <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-[#ACABAA]">
            Architectural Management
          </p>
        </Link>
        <Link
          href="/dashboard/properties"
          className="mt-6 flex items-center gap-2 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[#BD9952] transition-colors hover:text-[#C9C6C5]"
        >
          <PlusCircle className="size-4 stroke-[1.25]" aria-hidden />
          Add a property
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-0">
        <nav className="flex flex-1 flex-col px-0">
          <NavSection label="Main" items={mainItems} pathname={pathname} />
          <NavSection label="Workflow" items={workflowItems} pathname={pathname} />
          <NavSection label="More" items={moreItems} pathname={pathname} />
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-[#484848]/15 p-4">
        <Link
          href="/dashboard/assistant"
          className="mb-2 flex items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] text-[#ACABAA] transition-colors hover:bg-[#1F2020] hover:text-[#C9C6C5]"
        >
          <HelpCircle className="size-5 stroke-[1.25]" aria-hidden />
          Help
        </Link>
        <Link
          href="/dashboard/settings"
          className="mb-4 flex items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] text-[#ACABAA] transition-colors hover:bg-[#1F2020] hover:text-[#C9C6C5]"
        >
          <Settings className="size-5 stroke-[1.25]" aria-hidden />
          Settings
        </Link>
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1F2020] font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase text-[#C9C6C5]">
            {(userEmail?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] text-[#C9C6C5]">
              Profile
            </p>
            <p className="truncate font-[family-name:var(--font-inter)] text-[0.65rem] text-[#ACABAA]">
              {userEmail ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-[#ACABAA] transition-colors hover:bg-[#1F2020] hover:text-[#C9C6C5]"
            aria-label="Log out"
          >
            <LogOut className="size-4 stroke-[1.25]" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
