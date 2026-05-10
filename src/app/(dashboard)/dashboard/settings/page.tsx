/**
 * Settings panel — backed by `user_settings` (see migration
 * `20260710120000_user_settings_full_panel.sql` for the column shape and
 * the `user-assets` storage bucket used for org logos and avatars).
 *
 * The page renders the new tabbed shell. All persistence lives in
 * `src/lib/actions/user-settings.ts` and is re-exported through
 * `./actions.ts` so each tab's components import from this folder.
 */

export const dynamic = "force-dynamic";

import { Suspense } from "react";

import { SettingsShell, type SettingsShellInitialValues } from "@/components/settings/settings-shell";
import { displayNameFromUserMetadata } from "@/lib/auth/profile-hints";
import { getUserSettings } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";

const defaultShell: SettingsShellInitialValues = {
  organisation: {
    orgName: "",
    orgLogoUrl: "",
    orgContactEmail: "",
    orgPhone: "",
    orgAddress: "",
  },
  profile: {
    firstName: "",
    lastName: "",
    email: "",
    avatarUrl: "",
  },
  aiChase: {
    chaseTriggerDays: 3,
    chaseMaxPerMonth: 3,
    chaseMinGapDays: 5,
    chaseAllowWeekends: false,
    chaseEscalationThreshold: 3,
    chaseTone1: "friendly",
    chaseTone2: "firm",
    chaseTone3: "formal",
    chaseRequireApproval: true,
    chaseAiProactive: true,
  },
  emailTemplates: {
    emailSenderName: "",
    emailReplyTo: "",
    emailChase1Subject: "",
    emailChase1Body: "",
    emailChase2Subject: "",
    emailChase2Body: "",
    emailChase3Subject: "",
    emailChase3Body: "",
  },
  notifications: {
    notifRentOverdue: true,
    notifRentOverdueDays: 3,
    notifEscalation: true,
    notifApprovalReady: true,
    notifApprovalQueueThreshold: 5,
    notifMaintenance: true,
    notifWeeklyDigest: true,
    notifDigestDay: "mon",
    notifDigestTime: "08:00",
  },
  appearance: "system",
};

function SettingsSkeleton() {
  return (
    <div className="min-h-full bg-zinc-50 px-4 py-8 dark:bg-[#0B0B0B] sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="h-7 w-40 animate-pulse rounded bg-zinc-200 dark:bg-[#161616]" />
        <div className="h-4 w-80 animate-pulse rounded bg-zinc-200 dark:bg-[#161616]" />
        <div className="grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="hidden h-72 animate-pulse rounded-xl bg-zinc-200 md:block dark:bg-[#161616]" />
          <div className="h-96 animate-pulse rounded-xl bg-zinc-200 dark:bg-[#161616]" />
        </div>
      </div>
    </div>
  );
}

async function SettingsAsync() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const existing = user?.id ? await getUserSettings(user.id) : null;

  const authName = displayNameFromUserMetadata(
    user?.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : undefined,
  );
  const [authFirst = "", ...authRest] = authName.split(" ");
  const authLast = authRest.join(" ");

  const initial: SettingsShellInitialValues = {
    organisation: {
      orgName: existing?.orgName || existing?.businessName || defaultShell.organisation.orgName,
      orgLogoUrl: existing?.orgLogoUrl || defaultShell.organisation.orgLogoUrl,
      orgContactEmail:
        existing?.orgContactEmail || existing?.contactEmail || defaultShell.organisation.orgContactEmail,
      orgPhone: existing?.orgPhone || existing?.contactPhone || defaultShell.organisation.orgPhone,
      orgAddress:
        existing?.orgAddress || existing?.businessAddress || defaultShell.organisation.orgAddress,
    },
    profile: {
      firstName: existing?.firstName || authFirst || defaultShell.profile.firstName,
      lastName: existing?.lastName || authLast || defaultShell.profile.lastName,
      email: existing?.contactEmail || user?.email || defaultShell.profile.email,
      avatarUrl: existing?.avatarUrl || defaultShell.profile.avatarUrl,
    },
    aiChase: {
      chaseTriggerDays: existing?.chaseTriggerDays ?? defaultShell.aiChase.chaseTriggerDays,
      chaseMaxPerMonth: existing?.chaseMaxPerMonth ?? defaultShell.aiChase.chaseMaxPerMonth,
      chaseMinGapDays: existing?.chaseMinGapDays ?? defaultShell.aiChase.chaseMinGapDays,
      chaseAllowWeekends: existing?.chaseAllowWeekends ?? defaultShell.aiChase.chaseAllowWeekends,
      chaseEscalationThreshold:
        existing?.chaseEscalationThreshold ?? defaultShell.aiChase.chaseEscalationThreshold,
      chaseTone1: existing?.chaseTone1 ?? defaultShell.aiChase.chaseTone1,
      chaseTone2: existing?.chaseTone2 ?? defaultShell.aiChase.chaseTone2,
      chaseTone3: existing?.chaseTone3 ?? defaultShell.aiChase.chaseTone3,
      chaseRequireApproval:
        existing?.chaseRequireApproval ?? defaultShell.aiChase.chaseRequireApproval,
      chaseAiProactive: existing?.chaseAiProactive ?? defaultShell.aiChase.chaseAiProactive,
    },
    emailTemplates: {
      emailSenderName:
        existing?.emailSenderName || existing?.emailFromName || defaultShell.emailTemplates.emailSenderName,
      emailReplyTo: existing?.emailReplyTo || defaultShell.emailTemplates.emailReplyTo,
      emailChase1Subject:
        existing?.emailChase1Subject || defaultShell.emailTemplates.emailChase1Subject,
      emailChase1Body: existing?.emailChase1Body || defaultShell.emailTemplates.emailChase1Body,
      emailChase2Subject:
        existing?.emailChase2Subject || defaultShell.emailTemplates.emailChase2Subject,
      emailChase2Body: existing?.emailChase2Body || defaultShell.emailTemplates.emailChase2Body,
      emailChase3Subject:
        existing?.emailChase3Subject || defaultShell.emailTemplates.emailChase3Subject,
      emailChase3Body: existing?.emailChase3Body || defaultShell.emailTemplates.emailChase3Body,
    },
    notifications: {
      notifRentOverdue: existing?.notifRentOverdue ?? defaultShell.notifications.notifRentOverdue,
      notifRentOverdueDays:
        existing?.notifRentOverdueDays ?? defaultShell.notifications.notifRentOverdueDays,
      notifEscalation: existing?.notifEscalation ?? defaultShell.notifications.notifEscalation,
      notifApprovalReady:
        existing?.notifApprovalReady ?? defaultShell.notifications.notifApprovalReady,
      notifApprovalQueueThreshold:
        existing?.notifApprovalQueueThreshold ?? defaultShell.notifications.notifApprovalQueueThreshold,
      notifMaintenance: existing?.notifMaintenance ?? defaultShell.notifications.notifMaintenance,
      notifWeeklyDigest: existing?.notifWeeklyDigest ?? defaultShell.notifications.notifWeeklyDigest,
      notifDigestDay: existing?.notifDigestDay ?? defaultShell.notifications.notifDigestDay,
      notifDigestTime: existing?.notifDigestTime ?? defaultShell.notifications.notifDigestTime,
    },
    appearance: existing?.themePreference ?? defaultShell.appearance,
  };

  return <SettingsShell initial={initial} authEmail={user?.email ?? ""} />;
}

export default function SettingsPage() {
  return (
    <div className="@container/main relative flex flex-1 flex-col bg-zinc-50 text-zinc-950 dark:bg-[#0B0B0B] dark:text-zinc-100">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsAsync />
      </Suspense>
    </div>
  );
}
