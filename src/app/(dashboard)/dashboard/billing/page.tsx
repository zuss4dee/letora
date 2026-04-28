import Link from "next/link";

import { CurrentPlanSummary } from "@/components/billing/current-plan-summary";
import { ManageBillingButton } from "@/components/settings/manage-billing-button";
import { getUserSettings } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; cancelled?: string }>;
}) {
  const sp = await searchParams;
  const checkoutState = typeof sp.checkout === "string" ? sp.checkout : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existing = user?.id ? await getUserSettings(user.id) : null;
  const hasStripeCustomer = Boolean(existing?.stripeCustomerId?.trim());

  return (
    <div className="@container/main relative flex flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,420px)] bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(255,255,255,0.04),transparent_65%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-10 py-8 md:py-12">
        <header className="space-y-4 px-4 lg:px-6">
          <div className="max-w-2xl space-y-3">
            <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Workspace
            </p>
            <h1 className="font-headline text-2xl font-extralight tracking-[-0.04em] text-foreground sm:text-3xl md:text-[2.15rem] md:leading-tight">
              Billing
            </h1>
          </div>

          {checkoutState === "success" ? (
            <div
              className="max-w-xl rounded-lg border border-zinc-800 bg-[#1a1a1a]/90 px-4 py-3 font-[family-name:var(--font-inter)] text-sm text-foreground"
              role="status"
            >
              Checkout completed. Your subscription and trial are handled in Stripe; it may take a minute for this page
              to reflect updates.
            </div>
          ) : null}
          {checkoutState === "cancelled" ? (
            <div
              className="max-w-xl rounded-lg border border-zinc-800 bg-[#1a1a1a]/90 px-4 py-3 font-[family-name:var(--font-inter)] text-sm text-muted-foreground"
              role="status"
            >
              Checkout was cancelled — no charge. You can try again from the{" "}
              <Link href="/pricing" className="font-medium text-foreground hover:text-zinc-400 underline-offset-4 hover:underline">
                pricing page
              </Link>
              .
            </div>
          ) : null}

          {user?.id ? (
            <div className="max-w-4xl space-y-8 pt-2">
              <CurrentPlanSummary settings={existing} hasStripeCustomer={hasStripeCustomer} />

              {hasStripeCustomer ? (
                <div className="space-y-3">
                  <p className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
                    Update your card, view invoices, or cancel in the Stripe customer portal.
                  </p>
                  <ManageBillingButton />
                </div>
              ) : (
                <p className="max-w-xl font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-foreground">
                  Your plan is selected when you join Letora. If checkout didn&apos;t finish, continue from the{" "}
                  <Link href="/pricing" className="font-medium text-foreground hover:text-zinc-400 underline-offset-4 hover:underline">
                    pricing page
                  </Link>
                  .
                </p>
              )}
            </div>
          ) : null}
        </header>
      </div>
    </div>
  );
}
