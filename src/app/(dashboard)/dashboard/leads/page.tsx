import { notFound } from "next/navigation";

import { LeadsRegistry } from "@/components/leads/leads-registry";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { getLeads } from "@/lib/actions/leads";
import { getPropertyPickList } from "@/lib/actions/properties";
import { createClient } from "@/lib/supabase/server";

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const [leads, properties] = await Promise.all([getLeads(), getPropertyPickList()]);

  return (
    <>
      <DashboardPollRefresh />
      <div className="@container/main flex flex-1 flex-col">
        <LeadsRegistry leads={leads} properties={properties} />
      </div>
    </>
  );
}
