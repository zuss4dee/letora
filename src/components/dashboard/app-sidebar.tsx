"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Command,
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
  Sparkles,
  Upload,
  UserCircle2,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";

import { useOpenCommandPalette } from "@/components/dashboard/dashboard-command-palette";
import { SidebarAgentActivityButton } from "@/components/dashboard/sidebar-agent-activity-button";
import { useSidebarDynamicOptional } from "@/components/dashboard/sidebar-dynamic-context";
import { getSidebarPlanStatusCompact } from "@/lib/billing/subscription-display";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  badgeCount?: number;
  badgeTitle?: string;
};

const mainItems: NavItem[] = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Properties", url: "/dashboard/properties", icon: Building2 },
  { title: "Tenants", url: "/dashboard/tenants", icon: Users },
];

const workflowItemsBase: NavItem[] = [
  { title: "Tenancies", url: "/dashboard/tenancies", icon: Key },
  { title: "Compliance", url: "/dashboard/compliance", icon: ClipboardCheck },
  { title: "Contracts", url: "/dashboard/contracts", icon: FileText },
  { title: "Maintenance", url: "/dashboard/maintenance", icon: Wrench },
];

const moreItems: NavItem[] = [
  { title: "AI Assistant", url: "/dashboard/assistant", icon: Sparkles },
  { title: "Rent Tracker", url: "/dashboard/rent-tracker", icon: CircleDollarSign },
  { title: "Leads", url: "/dashboard/leads", icon: UserPlus },
  { title: "Import", url: "/dashboard/import", icon: Upload },
  { title: "Emails", url: "/dashboard/emails", icon: Mail },
];

function isActivePath(pathname: string, url: string) {
  if (url === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

function planPresenceStyles(subscriptionStatus: string | null | undefined): {
  dot: string;
  ping?: string;
} {
  const st = subscriptionStatus?.toLowerCase() ?? "";
  if (st === "active") {
    return {
      dot: "bg-[#2dd4bf] shadow-[0_0_0_1px_rgb(45_212_191/0.35),0_0_14px_rgb(45_212_191/0.25)]",
      ping: "bg-[#2dd4bf]",
    };
  }
  if (st === "trialing") return { dot: "bg-amber-400", ping: "bg-amber-300" };
  if (st === "past_due") return { dot: "bg-orange-500" };
  if (st === "inactive" || st === "canceled" || st === "cancelled" || st === "unpaid") {
    return { dot: "bg-zinc-500" };
  }
  if (!st) return { dot: "bg-[#6b6966]" };
  return { dot: "bg-sky-500", ping: "bg-sky-400" };
}

/** Dense operational nav rows with tonal active treatment. */
const navRowBase =
  "relative mx-2 flex touch-manipulation items-center gap-2.5 rounded-md px-2.5 py-2 text-left font-[family-name:var(--font-inter)] text-[0.74rem] font-medium leading-none tracking-[0.01em] transition-[background-color,color,box-shadow] duration-150 ease-out";
const navRowIdle =
  "text-[#6a655d] hover:bg-black/[0.04] hover:text-[#23211f] active:bg-black/[0.06] dark:text-[#a19f9a] dark:hover:bg-white/[0.055] dark:hover:text-[#e7e5e2] dark:active:bg-white/[0.07]";
const navRowActive =
  "bg-zinc-100 text-zinc-900 shadow-[inset_2px_0_0_0_#000000] dark:bg-zinc-800/80 dark:text-zinc-100 dark:shadow-[inset_2px_0_0_0_#ffffff]";

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
  attentionItems?: AttentionItem[];
  onNavigate?: () => void;
}) {
  const attentionByUrl = new Map(attentionItems?.map((a) => [a.url, a] as const) ?? []);

  return (
    <div className="mb-1.5">
      <span className="mb-1.5 block px-5 font-[family-name:var(--font-inter)] text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[#7f7569] dark:text-[#7a7772]">
        {label}
      </span>
      <ul className="flex flex-col gap-px">
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
                className={cn("group", navRowBase, active ? navRowActive : navRowIdle)}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 stroke-[1.5] transition-colors duration-150",
                    active
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.badgeCount != null && item.badgeCount > 0 ? (
                  <span
                    className="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-1 font-[family-name:var(--font-inter)] text-[0.58rem] font-semibold tabular-nums text-red-600 dark:bg-red-500/10 dark:text-red-500"
                    aria-label={`${item.badgeCount} items pending approval`}
                    title={item.badgeTitle}
                  >
                    {item.badgeCount > 99 ? "99+" : item.badgeCount}
                  </span>
                ) : null}
                {showDot && attention ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-[#c45c52] ring-2 ring-[#c45c52]/30 dark:ring-[#c45c52]/25"
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
  pendingApprovalsCount = 0,
  pendingApprovalsBadgeTitle = null,
  variant,
  side,
  collapsible,
  className,
}: Pick<React.ComponentProps<typeof Sidebar>, "variant" | "side" | "collapsible" | "className"> & {
  userEmail?: string | null;
  complianceAttention?: boolean;
  maintenanceAttention?: boolean;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionPeriodEnd?: string | null;
  subscriptionTrialEnd?: string | null;
  pendingApprovalsCount?: number;
  pendingApprovalsBadgeTitle?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openPalette } = useOpenCommandPalette();
  const { isMobile, setOpenMobile } = useSidebar();
  const dyn = useSidebarDynamicOptional();
  const d = dyn?.state;

  const complianceResolved = complianceAttention ?? d?.complianceAttention ?? false;
  const maintenanceResolved = maintenanceAttention ?? d?.maintenanceAttention ?? false;
  const subscriptionPlanResolved = subscriptionPlan ?? d?.subscriptionPlan ?? null;
  const subscriptionStatusResolved = subscriptionStatus ?? d?.subscriptionStatus ?? null;
  const subscriptionPeriodEndResolved = subscriptionPeriodEnd ?? d?.subscriptionPeriodEnd ?? null;
  const subscriptionTrialEndResolved = subscriptionTrialEnd ?? d?.subscriptionTrialEnd ?? null;
  const pendingApprovalsBadgeTitleResolved =
    pendingApprovalsBadgeTitle ?? d?.pendingApprovalsBadgeTitle ?? null;
  const serverPendingApprovalsCount = d?.pendingApprovalsCount ?? pendingApprovalsCount;

  const [livePendingApprovalCount, setLivePendingApprovalCount] = React.useState(pendingApprovalsCount);

  React.useEffect(() => {
    setLivePendingApprovalCount((c) =>
      Math.max(c, pendingApprovalsCount, serverPendingApprovalsCount),
    );
  }, [pendingApprovalsCount, serverPendingApprovalsCount]);

  const refreshPendingApprovalCount = React.useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;

    const { count, error } = await supabase
      .from("agent_approvals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (error) {
      console.warn("[AppSidebar] pending approvals count", error.message);
      return;
    }

    setLivePendingApprovalCount(count ?? 0);
  }, []);

  React.useEffect(() => {
    void refreshPendingApprovalCount();
  }, [pathname, refreshPendingApprovalCount]);

  React.useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") void refreshPendingApprovalCount();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshPendingApprovalCount]);

  const closeMobileNav = React.useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);
  const [footerOpen, setFooterOpen] = useFooterOpen();
  const onSettingsPage = pathname === "/dashboard/settings";
  const onBillingPage = pathname === "/dashboard/billing";
  const settingsNavActive = onSettingsPage;
  const billingNavActive = onBillingPage;

  const workflowAttention: AttentionItem[] = [];
  if (complianceResolved) {
    workflowAttention.push({
      url: "/dashboard/compliance",
      title: "Expired certificate",
      ariaLabel: "Compliance: expired certificate on record",
    });
  }
  if (maintenanceResolved) {
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
    subscriptionPlan: subscriptionPlanResolved,
    subscriptionStatus: subscriptionStatusResolved,
    subscriptionPeriodEnd: subscriptionPeriodEndResolved,
    subscriptionTrialEnd: subscriptionTrialEndResolved,
  };
  const planStatusLine = getSidebarPlanStatusCompact(subFields);
  const presence = planPresenceStyles(subscriptionStatusResolved);

  const workflowItems: NavItem[] = [
    ...workflowItemsBase,
    {
      title: "Approvals",
      url: "/dashboard/approvals",
      icon: BadgeCheck,
      badgeCount: livePendingApprovalCount > 0 ? livePendingApprovalCount : undefined,
      badgeTitle: pendingApprovalsBadgeTitleResolved ?? undefined,
    },
  ];

  const footerNavClass = (active: boolean) =>
    cn(navRowBase, "mb-0.5", active ? navRowActive : navRowIdle);

  return (
    <Sidebar
      collapsible={collapsible ?? "offcanvas"}
      variant={variant ?? "sidebar"}
      side={side}
      className={cn(
        "border-transparent [&_[data-sidebar=sidebar]]:border-transparent [&_[data-sidebar=sidebar]]:bg-zinc-50 dark:[&_[data-sidebar=sidebar]]:bg-[#0B0B0B]",
        className,
      )}
    >
      <SidebarHeader className="gap-0 px-0 pb-4 pt-6">
        <Link
          href="/dashboard"
          onClick={closeMobileNav}
          className="block touch-manipulation px-5 transition-opacity hover:opacity-90"
        >
          <p className="font-[family-name:var(--font-inter)] text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-[#857d73] dark:text-[#7d7974]">
            Letora OS
          </p>
          <span className="mt-1 block font-headline text-[1.2rem] font-semibold tracking-[-0.03em] text-[#1f1d1b] dark:text-[#f5f4f2]">
            Letora
          </span>
          <p className="mt-1 font-[family-name:var(--font-inter)] text-[0.6rem] font-medium uppercase tracking-[0.11em] text-[#7f7569] dark:text-[#84817d]">
            Operational panel
          </p>
        </Link>

        <div className="mx-5 mt-4 rounded-md bg-zinc-100 px-3 py-2.5 dark:bg-zinc-900/50">
          <p className="font-[family-name:var(--font-inter)] text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-[#7f7569] dark:text-[#7d7a75]">
            Subscription
          </p>
          <div
            className="mt-2 flex min-w-0 items-start gap-2.5"
            title={planStatusLine}
            aria-label={`Plan status: ${planStatusLine}`}
          >
            <span className="relative mt-0.5 flex h-2.5 w-2.5 shrink-0" aria-hidden>
              {presence.ping ? (
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-35",
                    presence.ping,
                  )}
                />
              ) : null}
              <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", presence.dot)} />
            </span>
            <p className="min-w-0 flex-1 font-[family-name:var(--font-inter)] text-[0.71rem] font-medium leading-snug text-[#3d3730] dark:text-[#cdccca]">
              {planStatusLine}
            </p>
          </div>
        </div>

        <div className="px-5 pt-4">
          <Link
            href="/dashboard/properties"
            onClick={closeMobileNav}
            className="flex touch-manipulation items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white py-2 font-[family-name:var(--font-inter)] text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            <PlusCircle className="size-4 shrink-0 stroke-[1.5]" aria-hidden />
            Add a property
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-0 pb-3 pt-1">
        <div className="mx-5 mb-3 h-px bg-black/[0.09] dark:bg-white/[0.07]" aria-hidden />
        <nav className="flex min-h-0 flex-1 flex-col" aria-label="Dashboard">
          <NavSection label="Main" items={mainItems} pathname={pathname} onNavigate={closeMobileNav} />
          <div className="my-2.5 mx-5 h-px bg-black/[0.08] dark:bg-white/[0.06]" aria-hidden />
          <NavSection
            label="Workflow"
            items={workflowItems}
            pathname={pathname}
            attentionItems={workflowAttention.length > 0 ? workflowAttention : undefined}
            onNavigate={closeMobileNav}
          />
          <div className="my-2.5 mx-5 h-px bg-black/[0.08] dark:bg-white/[0.06]" aria-hidden />
          <NavSection label="More" items={moreItems} pathname={pathname} onNavigate={closeMobileNav} />
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-none bg-transparent px-0 pb-4 pt-2">
        <div className="mx-5 mb-2.5 h-px bg-black/[0.09] dark:bg-white/[0.07]" aria-hidden />
        <button
          type="button"
          onClick={() => setFooterOpen((o) => !o)}
          className="mx-2 flex w-[calc(100%-1rem)] items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left font-[family-name:var(--font-inter)] text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[#7f7569] transition-colors hover:bg-black/[0.04] hover:text-[#5e554a] dark:text-[#7d7a75] dark:hover:bg-white/[0.04] dark:hover:text-[#b6b3ae]"
          aria-expanded={footerOpen}
          aria-controls="sidebar-footer-panel"
        >
          <span>Workspace</span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-[#7f7569] transition-transform duration-200 dark:text-[#7d7a75]", footerOpen && "rotate-180")}
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
            <div className={cn("flex flex-col gap-0.5 pt-1", !footerOpen && "pointer-events-none")}>
              <Link href="/dashboard/settings" onClick={closeMobileNav} className={footerNavClass(settingsNavActive)}>
                <Settings
                  className={cn(
                    "size-[18px] shrink-0 stroke-[1.5]",
                    settingsNavActive ? "text-[#97e6ec]" : "text-[#6b6966]",
                  )}
                  aria-hidden
                />
                Settings
              </Link>
              <Link href="/dashboard/billing" onClick={closeMobileNav} className={footerNavClass(billingNavActive)}>
                <CreditCard
                  className={cn(
                    "size-[18px] shrink-0 stroke-[1.5]",
                    billingNavActive ? "text-[#97e6ec]" : "text-[#6b6966]",
                  )}
                  aria-hidden
                />
                Billing
              </Link>
              <Link
                href="/dashboard/help"
                onClick={closeMobileNav}
                className={footerNavClass(isActivePath(pathname, "/dashboard/help"))}
              >
                <HelpCircle
                  className={cn(
                    "size-[18px] shrink-0 stroke-[1.5]",
                    isActivePath(pathname, "/dashboard/help") ? "text-[#97e6ec]" : "text-[#6b6966]",
                  )}
                  aria-hidden
                />
                Help
              </Link>
              <Link
                href="/dashboard/activity"
                onClick={closeMobileNav}
                className={footerNavClass(isActivePath(pathname, "/dashboard/activity"))}
              >
                <History
                  className={cn(
                    "size-[18px] shrink-0 stroke-[1.5]",
                    isActivePath(pathname, "/dashboard/activity") ? "text-[#97e6ec]" : "text-[#6b6966]",
                  )}
                  aria-hidden
                />
                History
              </Link>
              <SidebarAgentActivityButton
                onBeforeOpen={closeMobileNav}
                className={cn(navRowBase, navRowIdle, "mb-0.5")}
              />
              <div className="mx-2 mt-2 rounded-md bg-zinc-100 p-2.5 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#ddd7cc] font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-wide text-[#3b3329] ring-1 ring-black/[0.05] dark:bg-[#2a2826] dark:text-[#cdccca] dark:ring-white/[0.06]">
                    {(userEmail?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-[family-name:var(--font-inter)] text-[0.56rem] font-semibold uppercase tracking-[0.13em] text-[#7f7569] dark:text-[#8f8c87]">
                      Signed in
                    </p>
                    <p className="truncate font-[family-name:var(--font-inter)] text-[0.68rem] text-[#3d3730] dark:text-[#cdccca]">
                      {userEmail ?? "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[#7f7569] transition-colors hover:bg-black/[0.06] hover:text-[#201e1b] dark:text-[#7d7a75] dark:hover:bg-white/[0.06] dark:hover:text-[#e8e6e3]"
                    aria-label="Log out"
                  >
                    <LogOut className="size-4 stroke-[1.5]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
