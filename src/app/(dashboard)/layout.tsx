import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { SubscriptionPlanProvider } from "@/components/subscription-plan-provider";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("subscription_status,subscription_plan")
    .eq("user_id", user.id)
    .maybeSingle();

  const status = settings?.subscription_status ?? null;
  const isActive = status === "active" || status === "trialing";

  if (!settings || !isActive) {
    redirect("/pricing");
  }

  return (
    <SubscriptionPlanProvider plan={settings.subscription_plan ?? null}>
      {children}
    </SubscriptionPlanProvider>
  );
}

