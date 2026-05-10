import { Suspense } from "react";

import { WorkspaceBillingView } from "@/components/billing/workspace-billing-view";
import { getUserSettings } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function BillingAsyncSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existing = user?.id ? await getUserSettings(user.id) : null;

  return <WorkspaceBillingView settings={existing} />;
}

export default async function BillingPage() {
  return (
    <div className="@container/main relative flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-[#0b0b0b] dark:text-zinc-100">
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-0 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl py-10 md:py-12">
            <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-900" />}>
              <BillingAsyncSection />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
