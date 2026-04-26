"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
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
  Upload,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";

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

/** Nocturnal Architect — nav row: tonal hover, teal inset when active (no heavy borders). */
const navRowBase =
  "relative mx-2 flex touch-manipulation items-center gap-3 rounded-md px-3 py-2.5 text-left font-[family-name:var(--font-inter)] text-[0.8125rem] font-medium leading-snug tracking-[0.01em] transition-[background-color,color,box-shadow] duration-150 ease-out";
const navRowIdle =
  "text-[#6f6a62] hover:bg-black/[0.035] hover:text-[#1f1d1b] active:bg-black/[0.06] dark:text-[#94928e] dark:hover:bg-white/[0.045] dark:hover:text-[#e8e6e3] dark:active:bg-white/[0.07]";
const navRowActive =
  "bg-[#ebe8e2] text-[#1d1b19] shadow-[inset_3px_0_0_0_#01696f] dark:bg-[#242220] dark:text-[#f2f1ef]";

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
    <div className="mb-2">
      <span className="mb-2.5 block px-5 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#7f7569] dark:text-[#6b6966]">
        {label}
      </span>
      <ul className="flex flex-col gap-0.5">
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
                    "size-[18px] shrink-0 stroke-[1.5] transition-colors duration-150",
                    active ? "text-[#01696f] dark:text-[#97e6ec]" : "text-[#8a8176] group-hover:text-[#5a5146] dark:text-[#6b6966] dark:group-hover:text-[#b8b6b1]",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.badgeCount != null && item.badgeCount > 0 ? (
                  <span
                    className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-[#bd9952]/35 bg-[#f3ebdf] px-1 font-[family-name:var(--font-inter)] text-[0.625rem] font-semibold tabular-nums text-[#8d602b] dark:bg-[#2a2218] dark:text-[#d4a574]"
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
        "border-transparent [&_[data-sidebar=sidebar]]:border-transparent",
        className,
      )}
    >
      <SidebarHeader className="gap-0 px-0 pb-6 pt-9">
        <Link
          href="/dashboard"
          onClick={closeMobileNav}
          className="block touch-manipulation px-5 transition-opacity hover:opacity-90"
        >
          <span className="font-headline text-[1.35rem] font-semibold tracking-[-0.04em] text-[#1f1d1b] dark:text-[#f5f4f2]">
            Letora
          </span>
          <p className="mt-2 font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[#7f7569] dark:text-[#797876]">
            Architectural management
          </p>
        </Link>

        <div className="mx-5 mt-7 rounded-lg bg-[#f3f0ea] px-3.5 py-3 shadow-[inset_0_1px_0_0_rgb(0_0_0/0.04)] dark:bg-[#1c1b1a] dark:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]">
          <p className="font-[family-name:var(--font-inter)] text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[#7f7569] dark:text-[#6b6966]">
            Subscription
          </p>
          <div
            className="mt-2.5 flex min-w-0 items-start gap-3"
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
            <p className="min-w-0 flex-1 font-[family-name:var(--font-inter)] text-[0.78rem] font-medium leading-snug text-[#3d3730] dark:text-[#cdccca]">
              {planStatusLine}
            </p>
          </div>
        </div>

        <div className="px-5 pt-6">
          <Link
            href="/dashboard/properties"
            onClick={closeMobileNav}
            className="flex touch-manipulation items-center justify-center gap-2 rounded-md border border-[#01696f]/30 bg-[#01696f]/10 py-2.5 font-[family-name:var(--font-inter)] text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[#01555a] transition-colors hover:border-[#01696f]/55 hover:bg-[#01696f]/16 hover:text-[#01484c] dark:border-[#01696f]/35 dark:bg-[#01696f]/12 dark:text-[#97e6ec] dark:hover:bg-[#01696f]/18 dark:hover:text-[#b5f0f4]"
          >
            <PlusCircle className="size-4 shrink-0 stroke-[1.5]" aria-hidden />
            Add a property
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-0 pb-4">
        <div className="mx-5 mb-5 h-px bg-gradient-to-r from-transparent via-black/[0.09] to-transparent dark:via-white/[0.08]" aria-hidden />
        <nav className="flex min-h-0 flex-1 flex-col" aria-label="Dashboard">
          <NavSection label="Main" items={mainItems} pathname={pathname} onNavigate={closeMobileNav} />
          <div className="my-4 mx-5 h-px bg-gradient-to-r from-transparent via-black/[0.08] to-transparent dark:via-white/[0.06]" aria-hidden />
          <NavSection
            label="Workflow"
            items={workflowItems}
            pathname={pathname}
            attentionItems={workflowAttention.length > 0 ? workflowAttention : undefined}
            onNavigate={closeMobileNav}
          />
          <div className="my-4 mx-5 h-px bg-gradient-to-r from-transparent via-black/[0.08] to-transparent dark:via-white/[0.06]" aria-hidden />
          <NavSection label="More" items={moreItems} pathname={pathname} onNavigate={closeMobileNav} />
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-none bg-transparent px-0 pb-6 pt-2">
        <div className="mx-5 mb-4 h-px bg-gradient-to-r from-transparent via-black/[0.09] to-transparent dark:via-white/[0.08]" aria-hidden />
        <button
          type="button"
          onClick={() => setFooterOpen((o) => !o)}
          className="mx-2 flex w-[calc(100%-1rem)] items-center justify-between gap-2 rounded-md px-3 py-2 text-left font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#7f7569] transition-colors hover:bg-black/[0.04] hover:text-[#5e554a] dark:text-[#6b6966] dark:hover:bg-white/[0.04] dark:hover:text-[#a8a6a4]"
          aria-expanded={footerOpen}
          aria-controls="sidebar-footer-panel"
        >
          <span>Workspace</span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-[#7f7569] transition-transform duration-200 dark:text-[#6b6966]", footerOpen && "rotate-180")}
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
              <SidebarAgentActivityButton onBeforeOpen={closeMobileNav} />
              <div className="mx-2 mt-3 rounded-lg bg-[#f3f0ea] p-3 shadow-[inset_0_1px_0_0_rgb(0_0_0/0.04)] dark:bg-[#1c1b1a] dark:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#e3ddd2] font-[family-name:var(--font-inter)] text-[0.7rem] font-semibold uppercase tracking-wide text-[#3b3329] ring-1 ring-black/[0.05] dark:bg-[#2a2826] dark:text-[#cdccca] dark:ring-white/[0.06]">
                    {(userEmail?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#7f7569] dark:text-[#94928e]">
                      Signed in
                    </p>
                    <p className="truncate font-[family-name:var(--font-inter)] text-[0.72rem] text-[#3d3730] dark:text-[#cdccca]">
                      {userEmail ?? "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-[#7f7569] transition-colors hover:bg-black/[0.06] hover:text-[#201e1b] dark:text-[#6b6966] dark:hover:bg-white/[0.06] dark:hover:text-[#e8e6e3]"
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
