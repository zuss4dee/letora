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

import { AgentSettingsForm } from "@/components/settings/agent-settings-form";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
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
    <div className="space-y-3">
      <div className="h-24 animate-pulse bg-[#151515]" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-52 animate-pulse bg-[#151515]" />
        <div className="h-52 animate-pulse bg-[#151515]" />
      </div>
      <div className="h-64 animate-pulse bg-[#151515]" />
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

  return (
    <div className="space-y-4">
      <AgentSettingsForm initialValues={initialValues} userId={user?.id ?? ""} />
      {user?.id ? <DeleteAccountCard /> : null}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="@container/main relative flex flex-1 flex-col overflow-hidden bg-[#0b0b0b] text-[#e5e2e1]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[radial-gradient(ellipse_72%_58%_at_50%_-8%,rgba(61,26,10,0.34),transparent_68%)]" />
      <div className="relative flex h-full min-h-0 flex-col">
        <header className="border-b border-[#272727] bg-[#0f0f0f]/90 px-4 py-3 backdrop-blur-sm lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f8f8f]">
                Workspace / System Settings
              </p>
              <h1 className="font-[family-name:var(--font-inter)] text-[1.1rem] font-semibold tracking-[-0.01em] text-[#f4f4f4]">
                Workspace Preferences
              </h1>
              <p className="max-w-3xl font-[family-name:var(--font-inter)] text-[12px] leading-5 text-[#a0a0a0]">
                Manage account profile, automation controls, and operational defaults for tenancy workflows. Billing
                is handled on the{" "}
                <Link href="/dashboard/billing" className="text-[#d5d5d5] underline-offset-4 hover:underline">
                  Billing
                </Link>{" "}
                page.
              </p>
            </div>
            <div className="rounded border border-[#303030] bg-[#121212] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8a8a8a]">
              Live Config
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
          <div className="mx-auto w-full max-w-6xl border border-[#242424] bg-[#101010] p-3 md:p-4">
            <Suspense fallback={<SettingsSkeleton />}>
              <SettingsAsyncSection />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
