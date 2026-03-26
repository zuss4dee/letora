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

import { AgentSettingsForm } from "@/components/settings/agent-settings-form";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  rentChaserInstructions: "",
  minLeadScore: 70,
  preferredSources: [],
  disqualifyNoMovein: false,
  leadQualifierCriteria: "",
};

export default async function AgentSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userEmail = user?.email ?? null;
  const existing = user?.id ? await getUserSettings(user.id) : null;
  const initialValues = existing ? { ...defaultValues, ...existing } : defaultValues;

  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" userEmail={userEmail} />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="px-4 lg:px-6">
                  <h1 className="text-base font-semibold tracking-tight">Agent Settings</h1>
                  <p className="text-sm text-muted-foreground">
                    Customise how your AI agents communicate and operate.
                  </p>
                </div>
                <div className="px-4 lg:px-6">
                  <AgentSettingsForm initialValues={initialValues} userId={user?.id ?? ""} />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

