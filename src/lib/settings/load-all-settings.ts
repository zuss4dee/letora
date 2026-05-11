import { displayNameFromUserMetadata } from "@/lib/auth/profile-hints";
import { fetchUserSettingsRow, type UserSettingsRow } from "@/lib/actions/user-settings";
import { CHASE_EMAIL_DEFAULTS } from "@/lib/settings/email-template-defaults";
import type { SettingsShellInitialValues } from "@/components/settings/settings-shell";

const BASE_DEFAULTS: SettingsShellInitialValues = {
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
    emailChase1Subject: CHASE_EMAIL_DEFAULTS[1].subject,
    emailChase1Body: CHASE_EMAIL_DEFAULTS[1].body,
    emailChase2Subject: CHASE_EMAIL_DEFAULTS[2].subject,
    emailChase2Body: CHASE_EMAIL_DEFAULTS[2].body,
    emailChase3Subject: CHASE_EMAIL_DEFAULTS[3].subject,
    emailChase3Body: CHASE_EMAIL_DEFAULTS[3].body,
  },
  notifications: {
    notifRentOverdue: true,
    notifRentOverdueDays: 1,
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

function mergeEmailTemplates(existing: UserSettingsRow | null): SettingsShellInitialValues["emailTemplates"] {
  const d = CHASE_EMAIL_DEFAULTS;
  const pick = (saved: string | undefined, fallback: string) =>
    (saved ?? "").trim().length > 0 ? (saved as string) : fallback;

  return {
    emailSenderName: existing?.emailSenderName ?? existing?.emailFromName ?? "",
    emailReplyTo: existing?.emailReplyTo ?? "",
    emailChase1Subject: pick(existing?.emailChase1Subject, d[1].subject),
    emailChase1Body: pick(existing?.emailChase1Body, d[1].body),
    emailChase2Subject: pick(existing?.emailChase2Subject, d[2].subject),
    emailChase2Body: pick(existing?.emailChase2Body, d[2].body),
    emailChase3Subject: pick(existing?.emailChase3Subject, d[3].subject),
    emailChase3Body: pick(existing?.emailChase3Body, d[3].body),
  };
}

export type LoadAllSettingsResult = {
  initial: SettingsShellInitialValues;
  /** True when the Supabase read failed — UI should show defaults plus a warning banner. */
  loadFailed: boolean;
};

/**
 * Loads every settings tab payload from `user_settings` (single row per user).
 * Never returns null shapes: on fetch errors, returns defaults and `loadFailed: true`.
 */
export async function loadAllSettings(
  userId: string,
  authEmail: string,
  userMetadata: Record<string, unknown> | undefined,
): Promise<LoadAllSettingsResult> {
  const fetchResult = await fetchUserSettingsRow(userId);
  const loadFailed = !fetchResult.ok;
  const existing = fetchResult.ok ? fetchResult.row : null;

  const authName = displayNameFromUserMetadata(userMetadata);
  const [authFirst = "", ...authRest] = authName.split(" ");
  const authLast = authRest.join(" ");

  const initial: SettingsShellInitialValues = {
    organisation: {
      orgName:
        existing?.orgName ||
        existing?.businessName ||
        BASE_DEFAULTS.organisation.orgName,
      orgLogoUrl: existing?.orgLogoUrl || BASE_DEFAULTS.organisation.orgLogoUrl,
      orgContactEmail:
        existing?.orgContactEmail || existing?.contactEmail || BASE_DEFAULTS.organisation.orgContactEmail,
      orgPhone: existing?.orgPhone || existing?.contactPhone || BASE_DEFAULTS.organisation.orgPhone,
      orgAddress:
        existing?.orgAddress || existing?.businessAddress || BASE_DEFAULTS.organisation.orgAddress,
    },
    profile: {
      firstName: existing?.firstName || authFirst || BASE_DEFAULTS.profile.firstName,
      lastName: existing?.lastName || authLast || BASE_DEFAULTS.profile.lastName,
      avatarUrl: existing?.avatarUrl || BASE_DEFAULTS.profile.avatarUrl,
    },
    aiChase: {
      chaseTriggerDays: existing?.chaseTriggerDays ?? BASE_DEFAULTS.aiChase.chaseTriggerDays,
      chaseMaxPerMonth: existing?.chaseMaxPerMonth ?? BASE_DEFAULTS.aiChase.chaseMaxPerMonth,
      chaseMinGapDays: existing?.chaseMinGapDays ?? BASE_DEFAULTS.aiChase.chaseMinGapDays,
      chaseAllowWeekends: existing?.chaseAllowWeekends ?? BASE_DEFAULTS.aiChase.chaseAllowWeekends,
      chaseEscalationThreshold:
        existing?.chaseEscalationThreshold ?? BASE_DEFAULTS.aiChase.chaseEscalationThreshold,
      chaseTone1: existing?.chaseTone1 ?? BASE_DEFAULTS.aiChase.chaseTone1,
      chaseTone2: existing?.chaseTone2 ?? BASE_DEFAULTS.aiChase.chaseTone2,
      chaseTone3: existing?.chaseTone3 ?? BASE_DEFAULTS.aiChase.chaseTone3,
      chaseRequireApproval: existing?.chaseRequireApproval ?? BASE_DEFAULTS.aiChase.chaseRequireApproval,
      chaseAiProactive: existing?.chaseAiProactive ?? BASE_DEFAULTS.aiChase.chaseAiProactive,
    },
    emailTemplates: mergeEmailTemplates(existing),
    notifications: {
      notifRentOverdue: existing?.notifRentOverdue ?? BASE_DEFAULTS.notifications.notifRentOverdue,
      notifRentOverdueDays:
        existing?.notifRentOverdueDays ?? BASE_DEFAULTS.notifications.notifRentOverdueDays,
      notifEscalation: existing?.notifEscalation ?? BASE_DEFAULTS.notifications.notifEscalation,
      notifApprovalReady:
        existing?.notifApprovalReady ?? BASE_DEFAULTS.notifications.notifApprovalReady,
      notifApprovalQueueThreshold:
        existing?.notifApprovalQueueThreshold ?? BASE_DEFAULTS.notifications.notifApprovalQueueThreshold,
      notifMaintenance: existing?.notifMaintenance ?? BASE_DEFAULTS.notifications.notifMaintenance,
      notifWeeklyDigest: existing?.notifWeeklyDigest ?? BASE_DEFAULTS.notifications.notifWeeklyDigest,
      notifDigestDay: existing?.notifDigestDay ?? BASE_DEFAULTS.notifications.notifDigestDay,
      notifDigestTime: existing?.notifDigestTime ?? BASE_DEFAULTS.notifications.notifDigestTime,
    },
    appearance: existing?.themePreference ?? BASE_DEFAULTS.appearance,
  };

  return { initial, loadFailed };
}
