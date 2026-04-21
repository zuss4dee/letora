export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AssistantChat } from "./assistant/assistant-chat";
import { AssistantLanding } from "@/components/dashboard/assistant-landing";
import {
  ASSISTANT_UI_MESSAGE_LIMIT,
  createAssistantConversation,
  listAssistantConversationsForSession,
  listAssistantMessagesForConversation,
} from "@/lib/assistant-messages/store";
import { getHomePortfolioSnapshot } from "@/lib/dashboard/home-snapshot";
import {
  buildWorkspaceSetupChecklist,
  pendingWorkspaceSetupItems,
  workspaceSetupChecklistHasIncomplete,
} from "@/lib/onboarding/workspace-setup";
import { getUserSettings } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";

function deriveTitleFromFirstLine(text: string) {
  const line = text.split("\n")[0]?.trim() ?? "";
  if (!line) return "New chat";
  return line.length > 200 ? `${line.slice(0, 199)}…` : line;
}

function firstNameFromUser(email: string | null | undefined): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "there";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Single dashboard workspace: no separate “overview” or `/assistant` route.
 * - No `?c=` → new-message landing (Letora home).
 * - `?q=` → new conversation + redirect to `?c=&start=`.
 * - `?c=` → full chat (history sidebar + thread).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string; start?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const qParam = typeof sp.q === "string" ? sp.q.trim() : "";
  if (qParam) {
    const created = await createAssistantConversation(deriveTitleFromFirstLine(qParam));
    redirect(
      `/dashboard?c=${encodeURIComponent(created.id)}&start=${encodeURIComponent(qParam)}`,
    );
  }

  const requested = typeof sp.c === "string" ? sp.c : undefined;

  /** Landing: focus on starting a message; chat history opens via “All chats” or direct `?c=` links. */
  if (!requested) {
    const conversations = await listAssistantConversationsForSession();
    const homeMetrics =
      user?.id != null ? await getHomePortfolioSnapshot(user.id) : { totalProperties: 0, activeTenancies: 0 };

    const settings = user?.id ? await getUserSettings(user.id) : null;
    let tenancyCount = 0;
    let complianceCount = 0;
    let tenantCount = 0;
    if (user?.id) {
      const [tenanciesRes, complianceRes, tenantsRes] = await Promise.all([
        supabase.from("tenancies").select("id", { count: "exact", head: true }),
        supabase.from("compliance_records").select("id", { count: "exact", head: true }),
        supabase.from("tenants").select("id", { count: "exact", head: true }),
      ]);
      tenancyCount = tenanciesRes.count ?? 0;
      complianceCount = complianceRes.count ?? 0;
      tenantCount = tenantsRes.count ?? 0;
    }

    const setupChecklist = user?.id
      ? buildWorkspaceSetupChecklist({
          businessName: settings?.businessName,
          landlordName: settings?.landlordName,
          contactEmail: settings?.contactEmail,
          contactPhone: settings?.contactPhone,
          businessAddress: settings?.businessAddress,
          emailFromName: settings?.emailFromName,
          hasSeenTour: settings?.hasSeenTour === true,
          propertyCount: homeMetrics.totalProperties,
          tenantCount,
          tenancyCount,
          complianceCount,
        })
      : [];

    const showSetupReminder =
      Boolean(user?.id) &&
      workspaceSetupChecklistHasIncomplete(setupChecklist) &&
      !settings?.onboardingSetupReminderDismissedAt;

    const setupChecklistToShow = showSetupReminder ? pendingWorkspaceSetupItems(setupChecklist) : [];

    return (
      <div className="relative flex min-h-0 flex-1 flex-col bg-background">
        <div className="mx-auto w-full max-w-7xl flex-1 px-6 pb-20 pt-6 md:px-16 md:pt-10">
          <div className="mx-auto max-w-2xl">
            <AssistantLanding
              greetingName={firstNameFromUser(user?.email)}
              conversations={conversations}
              totalProperties={homeMetrics.totalProperties}
              activeTenancies={homeMetrics.activeTenancies}
              workspaceSetupChecklist={setupChecklistToShow}
            />
          </div>
        </div>
      </div>
    );
  }

  let conversations = await listAssistantConversationsForSession();

  if (conversations.length === 0) {
    const created = await createAssistantConversation("New chat");
    conversations = [created];
  }

  let activeId: string;
  if (requested && conversations.some((c) => c.id === requested)) {
    activeId = requested;
  } else {
    activeId = conversations[0]!.id;
  }

  if (sp.c !== activeId) {
    const q = new URLSearchParams();
    q.set("c", activeId);
    const legacyStart = typeof sp.start === "string" ? sp.start.trim() : "";
    if (legacyStart) q.set("start", legacyStart);
    redirect(`/dashboard?${q.toString()}`);
  }

  const legacyStart = typeof sp.start === "string" ? sp.start.trim() : "";

  const rawMessages = await listAssistantMessagesForConversation(
    activeId,
    ASSISTANT_UI_MESSAGE_LIMIT,
  );
  const initialMessages = rawMessages.map((m) => ({
    role: m.role,
    content: m.content,
    suggestedActions: m.metadata?.suggestedActions,
    pendingCeoAction: m.metadata?.pendingCeoAction,
  }));

  const starter =
    legacyStart && legacyStart.trim() && initialMessages.length === 0
      ? legacyStart.trim()
      : undefined;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col border border-border/80 bg-card md:mx-6 md:mb-6 md:mt-1 md:rounded-2xl md:shadow-sm dark:border-white/[0.06] dark:bg-background dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
        <AssistantChat
          key={activeId}
          conversations={conversations}
          activeConversationId={activeId}
          initialMessages={initialMessages}
          initialPromptToSend={starter}
        />
      </div>
    </div>
  );
}
