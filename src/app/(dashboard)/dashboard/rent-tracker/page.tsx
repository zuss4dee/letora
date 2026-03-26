import { AppSidebar } from "@/components/app-sidebar";
import { RentTrackerClient } from "@/components/rent-tracker/rent-tracker-client";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/server";

export default async function RentTrackerStandalonePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  const [propertiesRes, tenantsRes] = userId
    ? await Promise.all([
        supabase
          .from("properties")
          .select("id,address,city")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("tenant_profiles")
          .select("id,full_name,tenancies(property_id)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ])
    : [
        { data: [] as Array<{ id: string; address: string; city: string | null }> },
        { data: [] as Array<{ id: string; full_name: string | null; tenancies?: Array<{ property_id: string | null }> }> },
      ];

  const properties = (propertiesRes.data ?? []).map((p) => ({
    id: p.id,
    address: p.address ?? "Unknown property",
    city: p.city ?? null,
  }));

  const tenants = (tenantsRes.data ?? []).map((t) => ({
    id: t.id,
    fullName: t.full_name ?? "Unknown tenant",
    propertyId: t.tenancies?.[0]?.property_id ?? null,
  }));

  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" userEmail={userEmail} />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <RentTrackerClient properties={properties} tenants={tenants} />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

