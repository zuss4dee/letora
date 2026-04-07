import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { logAgentActivity } from "@/lib/agent-activity-log";
import { runMaintenanceAgent } from "@/lib/agents/maintenance-agent";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { maintenanceRequestId?: string };
  try {
    body = (await request.json()) as { maintenanceRequestId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const maintenanceRequestId = body.maintenanceRequestId?.trim();
  if (!maintenanceRequestId) {
    return NextResponse.json({ error: "maintenanceRequestId is required" }, { status: 400 });
  }

  const result = await runMaintenanceAgent(maintenanceRequestId, user.id, supabase, {
    landlordEmailFallback: user.email ?? undefined,
  });

  await logAgentActivity(supabase, {
    userId: user.id,
    agentName: "Maintenance",
    actionTaken: "run_maintenance_triage",
    inputSummary: `maintenanceRequestId=${maintenanceRequestId}`,
    outputSummary: result.success
      ? `agentRunId=${result.agentRunId}; triage=${result.triageCategory ?? "n/a"}; tenantEmail=${result.tenantEmailStatus ?? "n/a"}; landlordEmail=${result.landlordEmailStatus ?? "n/a"}`
      : result.message,
    status: result.success ? "success" : "error",
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        triageCategory: result.triageCategory,
      },
      { status: result.message === "Forbidden" ? 403 : 400 },
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/maintenance");
  revalidatePath(`/dashboard/maintenance/${maintenanceRequestId}`);

  return NextResponse.json({
    success: true,
    agentRunId: result.agentRunId,
    triageCategory: result.triageCategory,
    tenantEmailStatus: result.tenantEmailStatus,
    landlordEmailStatus: result.landlordEmailStatus,
  });
}
