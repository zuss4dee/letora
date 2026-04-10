import Link from "next/link";
import { Mail } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardHelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="@container/main relative flex flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,420px)] bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(189,153,82,0.12),transparent_65%)] dark:bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(61,26,10,0.35),transparent_65%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-10 px-4 py-8 md:py-12 lg:px-6">
        <header className="max-w-2xl space-y-3">
          <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#BD9952]/95">
            Workspace
          </p>
          <h1 className="font-headline text-3xl font-extralight tracking-[-0.04em] text-foreground md:text-[2.15rem] md:leading-tight">
            Help
          </h1>
          <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-muted-foreground">
            Quick links for using Letora and managing your account.
          </p>
        </header>

        <section className="max-w-xl rounded-xl border border-border bg-card p-6 shadow-sm ring-1 ring-border/60 dark:bg-card/80">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#BD9952]/12 ring-1 ring-[#BD9952]/25">
              <Mail className="size-5 text-[#BD9952]" aria-hidden />
            </div>
            <div className="min-w-0 space-y-2">
              <h2 className="font-headline text-lg font-light tracking-tight text-foreground">Contact</h2>
              <p className="font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-foreground">
                Need something that isn&apos;t covered here? Reach out — we&apos;ll plug in your preferred channel
                (email, form, or calendar) soon.
              </p>
              <p className="font-[family-name:var(--font-inter)] text-sm font-medium text-foreground">
                <span className="text-muted-foreground">For now:</span>{" "}
                <a
                  href="mailto:support@letora.app"
                  className="text-[#BD9952] underline-offset-4 transition-colors hover:text-[#c9a660] hover:underline"
                >
                  support@letora.app
                </a>{" "}
                <span className="font-normal text-muted-foreground">(placeholder — replace with your address)</span>
              </p>
            </div>
          </div>
        </section>

        <ul className="max-w-xl space-y-6 font-[family-name:var(--font-inter)] text-sm leading-relaxed text-foreground">
          <li className="rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-border/60 dark:border-[#4F4632]/20 dark:bg-[#161616]/80">
            <p className="font-medium text-foreground">Letora Assistant</p>
            <p className="mt-2 text-muted-foreground">
              Ask questions about your portfolio, rent, maintenance, and workflows from the main workspace.
            </p>
            <Link
              href="/dashboard"
              className="mt-3 inline-flex font-medium text-[#BD9952] underline-offset-4 hover:underline"
            >
              Open workspace
            </Link>
          </li>
          <li className="rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-border/60 dark:border-[#4F4632]/20 dark:bg-[#161616]/80">
            <p className="font-medium text-foreground">Plans & billing</p>
            <p className="mt-2 text-muted-foreground">
              Subscribe or change plan on Pricing. After you have an active Stripe profile, manage payment method and
              invoices under Settings.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <Link href="/pricing" className="font-medium text-[#BD9952] underline-offset-4 hover:underline">
                Pricing
              </Link>
              {user ? (
                <Link
                  href="/dashboard/billing"
                  className="font-medium text-[#BD9952] underline-offset-4 hover:underline"
                >
                  Billing
                </Link>
              ) : null}
            </div>
          </li>
          <li className="rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-border/60 dark:border-[#4F4632]/20 dark:bg-[#161616]/80">
            <p className="font-medium text-foreground">History & automations</p>
            <p className="mt-2 text-muted-foreground">
              Review agent runs and background activity from History in the sidebar.
            </p>
            <Link
              href="/dashboard/activity"
              className="mt-3 inline-flex font-medium text-[#BD9952] underline-offset-4 hover:underline"
            >
              Open History
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
