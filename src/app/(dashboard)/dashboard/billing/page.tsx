import Link from "next/link";

import { BillingPlanOptions } from "@/components/billing/billing-plan-options";
import { ManageBillingButton } from "@/components/settings/manage-billing-button";
import { getUserSettings } from "@/lib/actions/user-settings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
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
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,420px)] bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(61,26,10,0.35),transparent_65%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-10 py-8 md:py-12">
        <header className="space-y-4 px-4 lg:px-6">
          <div className="max-w-2xl space-y-3">
            <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#BD9952]/95">
              Workspace
            </p>
            <h1 className="font-headline text-3xl font-extralight tracking-[-0.04em] text-foreground md:text-[2.15rem] md:leading-tight">
              Billing
            </h1>
            <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-muted-foreground">
              Subscriptions and saved payment methods run through Stripe. You can start a plan here (card and Link by
              default — enable more methods in your Stripe Dashboard). Profile and automation stay under{" "}
              <Link href="/dashboard/settings" className="font-medium text-[#BD9952] underline-offset-4 hover:underline">
                Settings
              </Link>
              .
            </p>
          </div>

          {checkoutState === "success" ? (
            <div
              className="max-w-xl rounded-lg border border-[#4F4632]/30 bg-[#1a1a1a]/90 px-4 py-3 font-[family-name:var(--font-inter)] text-sm text-foreground"
              role="status"
            >
              Checkout completed. Your subscription and trial are handled in Stripe; it may take a minute for this page
              to reflect updates.
            </div>
          ) : null}
          {checkoutState === "cancelled" ? (
            <div
              className="max-w-xl rounded-lg border border-[#4F4632]/30 bg-[#1a1a1a]/90 px-4 py-3 font-[family-name:var(--font-inter)] text-sm text-muted-foreground"
              role="status"
            >
              Checkout was cancelled — no charge. Choose a plan below when you are ready.
            </div>
          ) : null}

          {user?.id ? (
            <div className="max-w-4xl space-y-8 pt-2">
              {hasStripeCustomer ? (
                <div className="space-y-3">
                  <p className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
                    Update your card, view invoices, or cancel in the Stripe customer portal.
                  </p>
                  <ManageBillingButton />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="font-headline text-lg font-light text-foreground">Choose a plan</h2>
                    <p className="max-w-2xl font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-foreground">
                      You will go to secure Stripe Checkout to add a payment method and start your trial. Charges follow
                      your plan and trial rules in Stripe.
                    </p>
                  </div>
                  <BillingPlanOptions />
                  <p className="font-[family-name:var(--font-inter)] text-xs text-muted-foreground">
                    Want the full marketing comparison?{" "}
                    <Link href="/pricing" className="text-[#BD9952] underline-offset-4 hover:underline">
                      View pricing page
                    </Link>
                    .
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </header>
      </div>
    </div>
  );
}
