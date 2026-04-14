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

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existing = user?.id ? await getUserSettings(user.id) : null;
  const rowMerged = existing ? { ...defaultValues, ...existing } : defaultValues;
  const initialValues = mergeSettingsWithAuthHints(rowMerged, user ?? null);

  return (
    <div className="@container/main relative flex flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,420px)] bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(61,26,10,0.35),transparent_65%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-10 py-8 md:py-12">
        <header className="px-4 lg:px-6">
          <div className="max-w-2xl space-y-3">
            <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#BD9952]/95">
              Account
            </p>
            <h1 className="font-headline text-3xl font-extralight tracking-[-0.04em] text-foreground md:text-[2.15rem] md:leading-tight">
              Settings
            </h1>
            <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-muted-foreground">
              Business profile, automation preferences, and email — tuned to how you run tenancies. Billing lives on
              the{" "}
              <Link href="/dashboard/billing" className="font-medium text-[#BD9952] underline-offset-4 hover:underline">
                Billing
              </Link>{" "}
              page.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-8 px-4 lg:px-6">
          <Suspense
            fallback={
              <div className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground">Loading settings…</div>
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
