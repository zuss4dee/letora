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
  Activity,
  Bot,
  Building2,
  CircleDollarSign,
  CommandIcon,
  Key,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Settings,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"

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
      title: "Emails",
      url: "/dashboard/emails",
      icon: <Mail />,
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
      title: "Activity",
      url: "/dashboard/activity",
      icon: <Activity />,
    },
    {
      title: "Assistant",
      url: "/dashboard/assistant",
      icon: <MessageSquare />,
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
