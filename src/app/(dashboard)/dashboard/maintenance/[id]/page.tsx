export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { MaintenanceOperationalCaseFile } from "@/components/maintenance/maintenance-operational-case-file";
import { DashboardPollRefresh } from "@/hooks/use-dashboard-poll-refresh";
import { getMaintenanceRequestDetail } from "@/lib/actions/maintenance";
import { createClient } from "@/lib/supabase/server";

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  if (!userId) notFound();

  const detail = await getMaintenanceRequestDetail(userId, id);
  if (!detail) notFound();

  return (
    <>
      <DashboardPollRefresh />
      <MaintenanceOperationalCaseFile detail={detail} />
    </>
  );
}
