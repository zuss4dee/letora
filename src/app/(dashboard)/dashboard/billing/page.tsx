import { Suspense } from "react";
import { getUserSettings } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceBillingView } from "@/components/billing/workspace-billing-view";

export const dynamic = "force-dynamic";

async function BillingAsyncSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existing = user?.id ? await getUserSettings(user.id) : null;
  const hasStripeCustomer = Boolean(existing?.stripeCustomerId?.trim());
  const hasPolarCustomer = Boolean(existing?.polarCustomerId?.trim());

  return (
    <WorkspaceBillingView 
      settings={existing} 
      hasStripeCustomer={hasStripeCustomer} 
      hasPolarCustomer={hasPolarCustomer} 
    />
  );
}

export default async function BillingPage() {
  return (
    <div className="@container/main relative flex flex-1 flex-col overflow-hidden bg-[#0b0b0b] text-white">
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-0 lg:px-12">
          <div className="mx-auto w-full max-w-6xl py-12">
            <Suspense fallback={<div className="h-96 bg-zinc-900 animate-pulse rounded-[2px]" />}>
              <BillingAsyncSection />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
