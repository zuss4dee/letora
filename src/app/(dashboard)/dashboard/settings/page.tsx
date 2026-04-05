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

import { AgentSettingsForm } from "@/components/settings/agent-settings-form";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
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

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existing = user?.id ? await getUserSettings(user.id) : null;
  const initialValues = existing ? { ...defaultValues, ...existing } : defaultValues;

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-6 py-4 md:py-6">
        <div className="px-4 lg:px-6">
          <h1 className="text-base font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your business profile and agent preferences.
          </p>
        </div>
        <div className="flex flex-col gap-6 px-4 lg:px-6">
          <Suspense
            fallback={
              <div className="text-sm text-muted-foreground">Loading settings…</div>
            }
          >
            <AgentSettingsForm initialValues={initialValues} userId={user?.id ?? ""} />
          </Suspense>
          {user?.id ? <DeleteAccountCard /> : null}
        </div>
      </div>
    </div>
  );
}
