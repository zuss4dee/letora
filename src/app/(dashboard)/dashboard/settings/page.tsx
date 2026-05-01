/**
 * Supabase migration SQL:
 *
 * CREATE TABLE user_settings (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID NOT NULL UNIQUE,
 *   business_name TEXT,
 *   landlord_name TEXT,
 *   contact_phone TEXT,
 *   contact_email TEXT,
 *   business_address TEXT,
 *   rent_chaser_tone TEXT DEFAULT 'professional',
 *   first_chase_days INTEGER DEFAULT 3,
 *   email_signoff TEXT,
 *   include_payment_plan BOOLEAN DEFAULT true,
 *   rent_chaser_instructions TEXT,
 *   min_lead_score INTEGER DEFAULT 70,
 *   preferred_sources TEXT[],
 *   disqualify_no_movein BOOLEAN DEFAULT false,
 *   lead_qualifier_criteria TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Users manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
 *
 * -- Storage bucket setup:
 * -- create bucket "contract-templates" (private)
 * -- add storage.objects RLS policies so users can manage only files under "contract-templates/{auth.uid()}/..."
 */

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";

import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form";
import { mergeSettingsWithAuthHints } from "@/lib/auth/profile-hints";
import { getUserSettings } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";
import { type UserSettingsInput } from "@/lib/validations/user-settings";

const defaultValues: UserSettingsInput = {
  businessName: "",
  landlordName: "",
  contactPhone: "",
  contactEmail: "",
  businessAddress: "",
  rentChaserTone: "professional_firm",
  firstChaseDays: 3,
  emailSignoff: "",
  includePaymentPlan: true,
  emailFromName: "",
  autoSendRentChaser: false,
  autoSendMaintenanceUpdates: false,
  autoSendOnboardingEmails: false,
  autoSendLeadUpdates: false,
  autoSendReferencingEmails: false,
  referencingAgencyName: "",
  referencingAgencyEmail: "",
  referencingAgencyNotes: "",
  rentChaserInstructions: "",
  minLeadScore: 70,
  preferredSources: [],
  disqualifyNoMovein: false,
  leadQualifierCriteria: "",
};

function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-64 animate-pulse bg-obsidian-surface-low rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse bg-obsidian-surface-low rounded-lg" />
        <div className="h-48 animate-pulse bg-obsidian-surface-low rounded-lg" />
      </div>
    </div>
  );
}

async function SettingsAsyncSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existing = user?.id ? await getUserSettings(user.id) : null;
  const rowMerged = existing ? { ...defaultValues, ...existing } : defaultValues;
  const initialValues = mergeSettingsWithAuthHints(rowMerged, user ?? null);

  const metadata = {
    businessName: existing?.businessName,
    subscriptionPlan: existing?.subscriptionPlan,
    subscriptionStatus: existing?.subscriptionStatus,
    subscriptionPeriodEnd: existing?.subscriptionPeriodEnd,
    subscriptionTrialEnd: existing?.subscriptionTrialEnd,
    onboardingStatus: existing?.onboardingStatus,
    stripeCustomerId: existing?.stripeCustomerId,
    stripeConnectAccountId: existing?.stripeConnectAccountId,
  };

  return (
    <WorkspaceSettingsForm initialValues={initialValues} metadata={metadata} userId={user?.id ?? ""} />
  );
}

export default function SettingsPage() {
  return (
    <div className="@container/main relative flex flex-1 flex-col overflow-hidden bg-[#0b0b0b] text-white">
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-0 lg:px-12">
          <div className="mx-auto w-full max-w-6xl">
            <Suspense fallback={<SettingsSkeleton />}>
              <SettingsAsyncSection />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
