import Link from "next/link";
import { notFound } from "next/navigation";

import { EditTenancyDialog } from "@/components/tenancies/edit-tenancy-dialog";
import { TenancyOnboardingPanel } from "@/components/tenancies/tenancy-onboarding-panel";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getTenancyOnboardingDetail } from "@/lib/actions/onboarding";
import { createClient } from "@/lib/supabase/server";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default async function TenancyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email ?? null;

  const detail = await getTenancyOnboardingDetail(id);
  if (!detail) return notFound();

  const { data: tenancy } = await supabase
    .from("tenancies")
    .select("start_date, end_date, move_in_date, monthly_rent, deposit_amount, status")
    .eq("id", id)
    .maybeSingle();

  const monthlyRent =
    tenancy?.monthly_rent == null
      ? null
      : typeof tenancy.monthly_rent === "number"
        ? tenancy.monthly_rent
        : Number(tenancy.monthly_rent);
  const deposit =
    tenancy?.deposit_amount == null
      ? null
      : typeof tenancy.deposit_amount === "number"
        ? tenancy.deposit_amount
        : Number(tenancy.deposit_amount);
  const startDate = tenancy?.start_date ?? detail.start_date ?? null;
  const endDate = tenancy?.end_date ?? null;
  const moveInDate = tenancy?.move_in_date ?? null;
  const tenancyStatus = tenancy?.status ?? null;

  const userId = user?.id ?? null;

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
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link
                      href="/dashboard/tenancies"
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      ← Tenancies
                    </Link>
                    <h1 className="mt-2 text-base font-semibold tracking-tight">Tenancy details</h1>
                    <p className="text-sm text-muted-foreground">
                      {detail.propertyAddress ?? "Property"} · {detail.tenantName ?? "Tenant"}
                    </p>
                  </div>
                  {userId ? (
                    <EditTenancyDialog
                      tenancyId={id}
                      userId={userId}
                      initial={{
                        startDate,
                        endDate,
                        moveInDate,
                        monthlyRent,
                        depositAmount: deposit,
                        status: tenancyStatus,
                      }}
                      triggerLabel="Edit tenancy"
                    />
                  ) : null}
                </div>

                <div className="grid gap-4 px-4 lg:px-6 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4 text-sm">
                    <div className="text-muted-foreground">Start date</div>
                    <div className="font-medium">{startDate ?? "—"}</div>
                  </div>
                  <div className="rounded-lg border border-border p-4 text-sm">
                    <div className="text-muted-foreground">End date</div>
                    <div className="font-medium">{endDate ?? "—"}</div>
                  </div>
                  <div className="rounded-lg border border-border p-4 text-sm">
                    <div className="text-muted-foreground">Move-in date</div>
                    <div className="font-medium">{moveInDate ?? "—"}</div>
                  </div>
                  <div className="rounded-lg border border-border p-4 text-sm">
                    <div className="text-muted-foreground">Status</div>
                    <div className="font-medium capitalize">{tenancyStatus ?? "—"}</div>
                  </div>
                  <div className="rounded-lg border border-border p-4 text-sm">
                    <div className="text-muted-foreground">Monthly rent</div>
                    <div className="font-medium">
                      {monthlyRent != null && Number.isFinite(monthlyRent) ? gbp.format(monthlyRent) : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-4 text-sm">
                    <div className="text-muted-foreground">Deposit</div>
                    <div className="font-medium">
                      {deposit != null && Number.isFinite(deposit) ? gbp.format(deposit) : "—"}
                    </div>
                  </div>
                </div>

                <div className="px-4 lg:px-6">
                  <TenancyOnboardingPanel
                    tenancyId={id}
                    onboardingStatus={detail.onboarding_status}
                    tasks={detail.tasks}
                  />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
