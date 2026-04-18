"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { chooseStarterPlanAction } from "@/lib/actions/billing";
import type { PlanKey } from "@/lib/stripe-plans";
import { cn } from "@/lib/utils";

const metallicCta =
  "bg-[#BD9952] text-[#141008] shadow-[0_0_22px_-2px_rgba(189,153,82,0.55),0_0_44px_-8px_rgba(189,153,82,0.28)] transition-[box-shadow,transform] hover:shadow-[0_0_32px_-2px_rgba(189,153,82,0.65),0_0_56px_-6px_rgba(189,153,82,0.35)] hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-50 disabled:shadow-none";

const STARTER_FREE_FEATURES = [
  "Up to 1 property to start (you can upgrade anytime)",
  "Tenant registry, tenancies and rent tracker",
  "Lead inbox and basic email automation",
  "No card required",
] as const;

const PRO_FEATURES = [
  "All AI agents — Rent Chaser, Lead Qualifier, Contract Drafter, Maintenance",
  "Up to 10 properties with higher fair-use limits",
  "Custom agent behaviour and email automation",
  "Priority support",
] as const;

export function PlanPicker({
  checkoutAvailable,
  pendingPlan,
}: {
  checkoutAvailable: boolean;
  pendingPlan: PlanKey | null;
}) {
  const router = useRouter();
  const [starterBusy, setStarterBusy] = useState(false);
  const [proBusy, setProBusy] = useState(false);

  const highlightPro = pendingPlan === "pro" || pendingPlan === "landlord_pro";

  async function pickStarter() {
    if (starterBusy || proBusy) return;
    setStarterBusy(true);
    try {
      const res = await chooseStarterPlanAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Starter selected. Let's finish your workspace setup.");
      router.replace("/onboarding");
      router.refresh();
    } finally {
      setStarterBusy(false);
    }
  }

  function pickPro() {
    if (starterBusy || proBusy) return;
    if (!checkoutAvailable) {
      toast.error("Pro checkout isn't available right now. Choose Starter to continue.");
      return;
    }
    setProBusy(true);
    window.location.href = "/api/stripe/checkout?plan=pro&return=onboarding";
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-black text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 55% at 50% -15%, rgba(189,153,82,0.11), transparent 58%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 pt-16 pb-10 md:px-12 md:pt-24">
        <header className="mb-12 flex flex-col gap-3 md:mb-16">
          <div className="flex items-center gap-4">
            <span className="font-headline text-[0.6rem] font-medium uppercase tracking-[0.38em] text-zinc-600">
              Letora
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/90 to-transparent" aria-hidden />
          </div>
          <div className="flex flex-col gap-3">
            <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#BD9952]/90">
              Choose your plan
            </p>
            <h1 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-white md:text-5xl">
              Pick the plan that fits your portfolio
            </h1>
            <p className="max-w-2xl font-headline text-base font-light leading-relaxed text-zinc-500">
              Start free with Starter and upgrade when you need the full agent layer, or jump straight into Pro with a
              card on file. You can change plans any time from Billing.
            </p>
          </div>
        </header>

        <div className="grid flex-1 gap-6 md:grid-cols-2">
          {/* Starter (Free) */}
          <article
            className={cn(
              "relative flex flex-col overflow-hidden rounded-sm border border-zinc-800/90 bg-zinc-950/40 p-8 md:p-10",
              !highlightPro && "ring-1 ring-[#BD9952]/30",
            )}
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-zinc-500">
                Starter
              </p>
              <span className="rounded-full border border-[#BD9952]/40 bg-[#BD9952]/10 px-3 py-1 font-headline text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#BD9952]">
                Free
              </span>
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-headline text-5xl font-extralight tracking-[-0.04em] text-white">£0</span>
              <span className="font-headline text-sm font-light text-zinc-500">/ month</span>
            </div>
            <p className="mt-3 max-w-sm font-headline text-sm font-light leading-relaxed text-zinc-500">
              Get into your workspace and add your first property today. No card, no commitment.
            </p>

            <ul className="mt-8 space-y-3">
              {STARTER_FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-[#BD9952]" aria-hidden />
                  <span className="font-headline text-sm font-light leading-relaxed text-zinc-300">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-10">
              <button
                type="button"
                onClick={() => void pickStarter()}
                disabled={starterBusy || proBusy}
                className={cn(
                  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-zinc-700 bg-transparent px-6 font-headline text-xs font-semibold uppercase tracking-[0.22em] text-zinc-200 transition-colors hover:border-[#BD9952]/60 hover:text-white disabled:opacity-50",
                )}
              >
                {starterBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <>
                    Continue free
                    <ArrowRight className="size-4 opacity-90" aria-hidden />
                  </>
                )}
              </button>
            </div>
          </article>

          {/* Pro (paid) */}
          <article
            className={cn(
              "relative flex flex-col overflow-hidden rounded-sm border bg-zinc-950/40 p-8 md:p-10",
              highlightPro
                ? "border-[#BD9952]/50 ring-1 ring-[#BD9952]/30"
                : "border-zinc-800/90",
            )}
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#BD9952]">
                Pro
              </p>
              <span className="rounded-full border border-[#BD9952]/40 bg-[#BD9952]/10 px-3 py-1 font-headline text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#BD9952]">
                Most popular
              </span>
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-headline text-5xl font-extralight tracking-[-0.04em] text-white">£39</span>
              <span className="font-headline text-sm font-light text-zinc-500">/ month</span>
            </div>
            <p className="mt-3 max-w-sm font-headline text-sm font-light leading-relaxed text-zinc-500">
              Full agent layer, more properties, priority support. Cancel any time.
            </p>

            <ul className="mt-8 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-[#BD9952]" aria-hidden />
                  <span className="font-headline text-sm font-light leading-relaxed text-zinc-300">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto space-y-2 pt-10">
              <button
                type="button"
                onClick={pickPro}
                disabled={starterBusy || proBusy || !checkoutAvailable}
                className={cn(
                  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 font-headline text-xs font-semibold uppercase tracking-[0.22em]",
                  metallicCta,
                )}
              >
                {proBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <>
                    Choose Pro &amp; add card
                    <ArrowRight className="size-4 opacity-90" aria-hidden />
                  </>
                )}
              </button>
              {!checkoutAvailable ? (
                <p className="font-headline text-[0.65rem] font-light leading-relaxed text-zinc-500">
                  Pro checkout isn&apos;t configured on this environment yet — start with Starter and we&apos;ll prompt
                  to upgrade once it&apos;s ready.
                </p>
              ) : null}
            </div>
          </article>
        </div>

        <footer className="mt-10 flex flex-col items-center gap-3 border-t border-zinc-900/90 pt-8 text-center md:mt-14">
          <p className="font-headline text-[0.65rem] font-light text-zinc-600">
            Need every plan side-by-side?{" "}
            <Link
              href="/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
            >
              Compare on the pricing page
            </Link>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}
