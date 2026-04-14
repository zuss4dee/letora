"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
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
import { getSidebarPlanStatusCompact } from "@/lib/billing/subscription-display";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
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
  { title: "Compliance", url: "/dashboard/compliance", icon: ClipboardCheck },
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

/** Sidebar “presence” dot: green glow = active paid subscription, amber = trial, etc. */
function planPresenceStyles(subscriptionStatus: string | null | undefined): {
  dot: string;
  ping?: string;
} {
  const st = subscriptionStatus?.toLowerCase() ?? "";
  if (st === "active") {
    return {
      dot: "bg-emerald-400 shadow-[0_0_10px_3px_rgba(52,211,153,0.75),0_0_22px_8px_rgba(16,185,129,0.28)]",
      ping: "bg-emerald-400",
    };
  }
  if (st === "trialing") return { dot: "bg-amber-400", ping: "bg-amber-300" };
  if (st === "past_due") return { dot: "bg-orange-500" };
  if (st === "inactive" || st === "canceled" || st === "cancelled" || st === "unpaid") {
    return { dot: "bg-zinc-500" };
  }
  if (!st) return { dot: "bg-zinc-400" };
  return { dot: "bg-sky-500", ping: "bg-sky-400" };
}

type AttentionItem = { url: string; title: string; ariaLabel: string };

function NavSection({
  label,
  items,
  pathname,
  attentionItems,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  /** Red dot + tooltip per matching nav URL (compliance expiry, maintenance safety, etc.). */
  attentionItems?: AttentionItem[];
  /** Close mobile sheet so one tap navigates (avoids double-tap / focus + click). */
  onNavigate?: () => void;
}) {
  const attentionByUrl = new Map(attentionItems?.map((a) => [a.url, a] as const) ?? []);

  return (
    <div className="mb-4">
      <span className="mb-2 block px-4 font-[family-name:var(--font-inter)] text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.url);
          const Icon = item.icon;
          const attention = attentionByUrl.get(item.url);
          const showDot = Boolean(attention);
          return (
            <li key={item.url}>
              <Link
                href={item.url}
                data-mercury-tour={item.url === "/dashboard/compliance" ? "compliance" : undefined}
                onClick={() => onNavigate?.()}
                className={cn(
                  "touch-manipulation flex items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] transition-colors duration-200 ease-out active:bg-sidebar-accent/80",
                  active
                    ? "border-l-2 border-secondary bg-sidebar-accent text-sidebar-accent-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/90 hover:text-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-5 shrink-0 stroke-[1.25]" aria-hidden />
                <span className="min-w-0 flex-1">{item.title}</span>
                {showDot && attention ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-red-500"
                    title={attention.title}
                    aria-label={attention.ariaLabel}
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const FOOTER_STORAGE_KEY = "letora-sidebar-footer-open";

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
  complianceAttention,
  maintenanceAttention,
  subscriptionPlan = null,
  subscriptionStatus = null,
  subscriptionPeriodEnd = null,
  subscriptionTrialEnd = null,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userEmail?: string | null;
  /** Any certificate past legal expiry — red dot on Compliance (not missing PDFs alone). */
  complianceAttention?: boolean;
  /** Active urgent safety alerts (last 7 days, non-resolved) — red dot on Maintenance. */
  maintenanceAttention?: boolean;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionPeriodEnd?: string | null;
  subscriptionTrialEnd?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeMobileNav = React.useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);
  const [footerOpen, setFooterOpen] = useFooterOpen();
  const onSettingsPage = pathname === "/dashboard/settings";
  const onBillingPage = pathname === "/dashboard/billing";
  const settingsNavActive = onSettingsPage;
  const billingNavActive = onBillingPage;

  const workflowAttention: AttentionItem[] = [];
  if (complianceAttention) {
    workflowAttention.push({
      url: "/dashboard/compliance",
      title: "Expired certificate",
      ariaLabel: "Compliance: expired certificate on record",
    });
  }
  if (maintenanceAttention) {
    workflowAttention.push({
      url: "/dashboard/maintenance",
      title: "Urgent safety alert",
      ariaLabel: "Maintenance: urgent safety alert in the last seven days",
    });
  }

  async function onLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const subFields = {
    subscriptionPlan,
    subscriptionStatus,
    subscriptionPeriodEnd,
    subscriptionTrialEnd,
  };
  const planStatusLine = getSidebarPlanStatusCompact(subFields);
  const presence = planPresenceStyles(subscriptionStatus);

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="sidebar"
      className="border-sidebar-border [&_[data-sidebar=sidebar]]:border-sidebar-border"
      {...props}
    >
      <SidebarHeader className="gap-0 px-4 pb-8 pt-8">
        <Link href="/dashboard" onClick={closeMobileNav} className="block touch-manipulation px-2">
          <span className="font-headline text-lg font-light tracking-[0.2em] text-foreground">
            LETORA
          </span>
          <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Architectural Management
          </p>
        </Link>
        <div className="mt-4 border-t border-sidebar-border/70 px-2 pt-3">
          <div
            className="flex min-w-0 items-center gap-2.5"
            title={planStatusLine}
            aria-label={`Plan status: ${planStatusLine}`}
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
              {presence.ping ? (
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-40",
                    presence.ping,
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-sidebar",
                  presence.dot,
                )}
              />
            </span>
            <p className="min-w-0 font-headline text-[0.75rem] font-medium leading-snug text-foreground">
              {planStatusLine}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/properties"
          onClick={closeMobileNav}
          className="mt-6 flex touch-manipulation items-center gap-2 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[#BD9952] transition-colors hover:text-foreground"
        >
          <PlusCircle className="size-4 stroke-[1.25]" aria-hidden />
          Add a property
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-0">
        <nav className="flex flex-1 flex-col px-0">
          <NavSection label="Main" items={mainItems} pathname={pathname} onNavigate={closeMobileNav} />
          <NavSection
            label="Workflow"
            items={workflowItems}
            pathname={pathname}
            attentionItems={workflowAttention.length > 0 ? workflowAttention : undefined}
            onNavigate={closeMobileNav}
          />
          <NavSection label="More" items={moreItems} pathname={pathname} onNavigate={closeMobileNav} />
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <button
          type="button"
          onClick={() => setFooterOpen((o) => !o)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted/90 hover:text-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground",
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
                href="/dashboard/help"
                onClick={closeMobileNav}
                className={cn(
                  "mb-2 flex touch-manipulation items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] transition-colors duration-200 ease-out",
                  isActivePath(pathname, "/dashboard/help")
                    ? "border-l-2 border-secondary bg-sidebar-accent text-sidebar-accent-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/90 hover:text-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground",
                )}
              >
                <HelpCircle className="size-5 stroke-[1.25]" aria-hidden />
                Help
              </Link>
              <Link
                href="/dashboard/activity"
                onClick={closeMobileNav}
                className={cn(
                  "mb-2 flex touch-manipulation items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] transition-colors duration-200 ease-out",
                  isActivePath(pathname, "/dashboard/activity")
                    ? "border-l-2 border-secondary bg-sidebar-accent text-sidebar-accent-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/90 hover:text-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground",
                )}
              >
                <History className="size-5 shrink-0 stroke-[1.25]" aria-hidden />
                History
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={closeMobileNav}
                className={cn(
                  "mb-2 flex touch-manipulation items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] transition-colors duration-200 ease-out",
                  settingsNavActive
                    ? "border-l-2 border-secondary bg-sidebar-accent text-sidebar-accent-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/90 hover:text-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground",
                )}
              >
                <Settings className="size-5 shrink-0 stroke-[1.25]" aria-hidden />
                Settings
              </Link>
              <Link
                href="/dashboard/billing"
                onClick={closeMobileNav}
                className={cn(
                  "mb-2 flex touch-manipulation items-center gap-3 px-4 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.12em] transition-colors duration-200 ease-out",
                  billingNavActive
                    ? "border-l-2 border-secondary bg-sidebar-accent text-sidebar-accent-foreground"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/90 hover:text-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground",
                )}
              >
                <CreditCard className="size-5 shrink-0 stroke-[1.25]" aria-hidden />
                Billing
              </Link>
              <SidebarAgentActivityButton onBeforeOpen={closeMobileNav} />
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase text-foreground">
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
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted/90 hover:text-foreground dark:hover:bg-sidebar-accent dark:hover:text-sidebar-foreground"
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
