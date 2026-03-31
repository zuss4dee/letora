import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runTenantOnboardingAgent } from "@/lib/agents/tenant-onboarding";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tenancyId?: string };
  try {
    body = (await request.json()) as { tenancyId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenancyId = body.tenancyId?.trim();
  if (!tenancyId) {
    return NextResponse.json({ error: "tenancyId is required" }, { status: 400 });
  }

  const result = await runTenantOnboardingAgent(tenancyId, user.id);

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        agentRunId: result.agentRunId,
        tasksCreated: result.tasksCreated,
        emailStatus: result.emailStatus,
        message: result.message,
      },
      { status: result.message === "Forbidden" ? 403 : 400 },
    );
  }

  revalidatePath(`/dashboard/tenancies/${tenancyId}`);
  revalidatePath("/dashboard/tenancies");

  return NextResponse.json({
    success: true,
    agentRunId: result.agentRunId,
    tasksCreated: result.tasksCreated,
    emailStatus: result.emailStatus,
    message: result.message,
  });
}
