"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Bot,
  Building2,
  CircleDollarSign,
  CommandIcon,
  Key,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useSubscriptionPlan } from "@/components/subscription-plan-provider"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboard />,
    },
    {
      title: "Properties",
      url: "/dashboard/properties",
      icon: <Building2 />,
    },
    {
      title: "Tenants",
      url: "/dashboard/tenants",
      icon: <Users />,
    },
    {
      title: "Tenancies",
      url: "/dashboard/tenancies",
      icon: <Key />,
    },
    {
      title: "Rent Tracker",
      url: "/dashboard/rent-tracker",
      icon: <CircleDollarSign />,
    },
    {
      title: "Maintenance",
      url: "/dashboard/maintenance",
      icon: <Wrench />,
    },
    {
      title: "Contracts",
      url: "/dashboard/contracts",
      icon: <FileText />,
    },
    {
      title: "Leads",
      url: "/dashboard/leads",
      icon: <UserPlus />,
    },
    {
      title: "Agents",
      url: "/dashboard/agents",
      icon: <Bot />,
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: <Settings />,
    },
  ],
}

export function AppSidebar({
  userEmail,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  userEmail?: string | null
}) {
  const router = useRouter()
  const plan = useSubscriptionPlan()

  const planLabel =
    plan === "landlord_pro"
      ? "Landlord Pro"
      : plan === "pro"
        ? "Pro"
        : plan === "starter"
          ? "Starter"
          : null

  const planClass =
    plan === "pro" || plan === "landlord_pro"
      ? "border border-violet-500/40 bg-violet-500/15 text-violet-200"
      : "border border-zinc-700 bg-zinc-800/70 text-zinc-200"

  async function onLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/dashboard">
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">Letora</span>
                {planLabel ? (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${planClass}`}>
                    {planLabel}
                  </span>
                ) : null}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">Signed in</div>
            <div className="truncate text-xs text-muted-foreground">
              {userEmail ?? "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted"
            aria-label="Log out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
