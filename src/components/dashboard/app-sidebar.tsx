"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FileText,
  HelpCircle,
  History,
  Home,
  Key,
  LogOut,
  Mail,
  PlusCircle,
  Settings,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";

import { SidebarAgentActivityButton } from "@/components/dashboard/sidebar-agent-activity-button";
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
];

const moreItems: NavItem[] = [
  { title: "Tenancies", url: "/dashboard/tenancies", icon: Key },
  { title: "Rent Tracker", url: "/dashboard/rent-tracker", icon: CircleDollarSign },
  { title: "Emails", url: "/dashboard/emails", icon: Mail },
  { title: "Leads", url: "/dashboard/leads", icon: UserPlus },
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
      <span className="mb-2 block px-4 font-[family-name:var(--font-inter)] text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
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
                    ? "border-l-2 border-[#BD9952] bg-[#2C2C2C] text-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-[#1F2020] hover:text-foreground",
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

const FOOTER_STORAGE_KEY = "letora-sidebar-footer-open";

/** Sync with `window.location.hash` for Settings vs Billing deep links. */
function useHash(pathname: string) {
  const [hash, setHash] = React.useState("");

  React.useEffect(() => {
    const sync = () => setHash(typeof window !== "undefined" ? window.location.hash : "");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  return hash;
}

function useFooterOpen() {
  const [footerOpen, setFooterOpen] = React.useState(true);

  React.useEffect(() => {
    try {
      const v = localStorage.getItem(FOOTER_STORAGE_KEY);
      if (v === "0") setFooterOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(FOOTER_STORAGE_KEY, footerOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [footerOpen]);

  return [footerOpen, setFooterOpen] as const;
}

export function AppSidebar({
  userEmail,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [footerOpen, setFooterOpen] = useFooterOpen();
  const hash = useHash(pathname);
  const onSettingsPage = pathname === "/dashboard/settings";
  const settingsNavActive = onSettingsPage && hash !== "#billing";
  const billingNavActive = onSettingsPage && hash === "#billing";

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
          <span className="font-headline text-lg font-light tracking-[0.2em] text-foreground">
            LETORA
          </span>
          <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Architectural Management
          </p>
        </Link>
        <Link
          href="/dashboard/properties"
          className="mt-6 flex items-center gap-2 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[#BD9952] transition-colors hover:text-foreground"
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
        <button
          type="button"
          onClick={() => setFooterOpen((o) => !o)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-[#1F2020] hover:text-foreground",
            footerOpen && "mb-2",
          )}
          aria-expanded={footerOpen}
          aria-controls="sidebar-footer-panel"
        >
          <span>Workspace</span>
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform duration-200", footerOpen && "rotate-180")}
            aria-hidden
          />
        </button>
        <div
          id="sidebar-footer-panel"
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            footerOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className={cn("flex flex-col gap-0", !footerOpen && "pointer-events-none")}>
              <Link
                href="/dashboard"
                className="mb-2 flex items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-[#1F2020] hover:text-foreground"
              >
                <HelpCircle className="size-5 stroke-[1.25]" aria-hidden />
                Help
              </Link>
              <Link
                href="/dashboard/activity"
                className={cn(
                  "mb-2 flex items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] transition-colors duration-300",
                  isActivePath(pathname, "/dashboard/activity")
                    ? "border-l-2 border-[#BD9952] bg-[#2C2C2C] text-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-[#1F2020] hover:text-foreground",
                )}
              >
                <History className="size-5 shrink-0 stroke-[1.25]" aria-hidden />
                History
              </Link>
              <Link
                href="/dashboard/settings"
                className={cn(
                  "mb-2 flex items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] transition-colors duration-300",
                  settingsNavActive
                    ? "border-l-2 border-[#BD9952] bg-[#2C2C2C] text-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-[#1F2020] hover:text-foreground",
                )}
              >
                <Settings className="size-5 shrink-0 stroke-[1.25]" aria-hidden />
                Settings
              </Link>
              <Link
                href="/dashboard/settings#billing"
                className={cn(
                  "mb-2 flex items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] transition-colors duration-300",
                  billingNavActive
                    ? "border-l-2 border-[#BD9952] bg-[#2C2C2C] text-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-[#1F2020] hover:text-foreground",
                )}
              >
                <CreditCard className="size-5 shrink-0 stroke-[1.25]" aria-hidden />
                Billing
              </Link>
              <SidebarAgentActivityButton />
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1F2020] font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase text-foreground">
                  {(userEmail?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] text-foreground">
                    Profile
                  </p>
                  <p className="truncate font-[family-name:var(--font-inter)] text-[0.65rem] text-muted-foreground">
                    {userEmail ?? "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[#1F2020] hover:text-foreground"
                  aria-label="Log out"
                >
                  <LogOut className="size-4 stroke-[1.25]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
