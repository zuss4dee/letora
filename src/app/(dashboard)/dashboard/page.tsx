export const dynamic = "force-dynamic";

import { AssistantLanding } from "@/components/dashboard/assistant-landing";
import { LetoraAiInsightCard } from "@/components/dashboard/letora-ai-insight-card";
import { LetoraDashboardKpiStrip } from "@/components/dashboard/letora-dashboard-kpi-strip";
import {
  getDashboardStats,
  getMonthlyRentFromActiveTenancies,
  getOverdueRentPaymentCount,
} from "@/lib/actions/dashboard";
import { createClient } from "@/lib/supabase/server";

function firstNameFromUser(email: string | null | undefined): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "there";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  let totalProperties = 0;
  let activeTenancies = 0;
  let monthlyRent = 0;
  let overduePayments = 0;
  let rentCollectedThisMonth = 0;
  let openMaintenance = 0;

  if (userId) {
    const [
      propertiesCountRes,
      tenanciesCountRes,
      monthlyRentTotal,
      overdueCount,
      dashboardStats,
    ] = await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("tenancies")
        .select("id, properties!inner(user_id)", { count: "exact", head: true })
        .eq("properties.user_id", userId)
        .eq("status", "active"),
      getMonthlyRentFromActiveTenancies(userId),
      getOverdueRentPaymentCount(userId),
      getDashboardStats(userId),
    ]);

    totalProperties = propertiesCountRes.count ?? 0;
    activeTenancies = tenanciesCountRes.count ?? 0;
    monthlyRent = monthlyRentTotal;
    overduePayments = overdueCount;
    rentCollectedThisMonth = dashboardStats?.rentCollectedThisMonth ?? 0;
    openMaintenance = dashboardStats?.openMaintenance ?? 0;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#0E0E0E]">
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 pb-16 pt-4 md:px-12 md:pt-2">
        <div className="mx-auto max-w-5xl">
          <AssistantLanding greetingName={firstNameFromUser(user?.email)} />
        </div>
        <LetoraDashboardKpiStrip
          activeTenancies={activeTenancies}
          totalProperties={totalProperties}
          monthlyRent={monthlyRent}
          rentCollectedThisMonth={rentCollectedThisMonth}
          overduePayments={overduePayments}
          openMaintenance={openMaintenance}
        />
        <div className="mx-auto max-w-5xl">
          <LetoraAiInsightCard />
        </div>
      </div>
    </div>
  );
}
