"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completeOnboardingGate,
  completeOnboardingWithProperty,
  saveOnboardingFocus,
  saveOnboardingIdentity,
  skipOnboarding,
} from "@/lib/actions/user-onboarding";
import { cn } from "@/lib/utils";

const FOCUS_OPTIONS = [
  {
    id: "automate_rent" as const,
    title: "Automate Rent",
    line: "Chasers, reminders, and rent roll in one place.",
  },
  {
    id: "legal_compliance" as const,
    title: "Legal Compliance",
    line: "Certificates and deadlines before they cost you.",
  },
  {
    id: "lead_management" as const,
    title: "Lead Management",
    line: "Qualify enquiries and move the right tenants faster.",
  },
];

const nextGlow =
  "bg-[#BD9952] text-[#141008] shadow-[0_0_22px_-2px_rgba(189,153,82,0.55),0_0_44px_-8px_rgba(189,153,82,0.28)] transition-[box-shadow,transform] hover:shadow-[0_0_32px_-2px_rgba(189,153,82,0.65),0_0_56px_-6px_rgba(189,153,82,0.35)] hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-50 disabled:shadow-none";

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? -40 : 40, opacity: 0 }),
};

function mapStoredGoalToFocus(
  stored: string | null | undefined,
): (typeof FOCUS_OPTIONS)[number]["id"] | null {
  if (!stored) return null;
  if (stored === "stay_compliant") return "legal_compliance";
  if (stored === "find_leads") return "lead_management";
  if (stored === "automate_rent") return "automate_rent";
  return null;
}

export function OnboardingWizard({
  initialStep,
  defaultPortfolioName = "",
  storedPrimaryGoal = null,
}: {
  initialStep: 0 | 1 | 2;
  defaultPortfolioName?: string;
  storedPrimaryGoal?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutHandled = useRef(false);
  const [step, setStep] = useState(initialStep);
  const [dir, setDir] = useState(0);

  const [portfolioName, setPortfolioName] = useState(defaultPortfolioName);
  const [focus, setFocus] = useState<(typeof FOCUS_OPTIONS)[number]["id"] | null>(
    () => mapStoredGoalToFocus(storedPrimaryGoal),
  );
  const [identityBusy, setIdentityBusy] = useState(false);
  const [focusBusy, setFocusBusy] = useState(false);

  const [addressLine, setAddressLine] = useState("");
  const [propertyBusy, setPropertyBusy] = useState(false);
  const [skipBusy, setSkipBusy] = useState(false);

  const finishCheckoutSuccess = useCallback(async () => {
    const res = await completeOnboardingGate();
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }, [router]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success" && !checkoutHandled.current) {
      checkoutHandled.current = true;
      void finishCheckoutSuccess();
    }
  }, [searchParams, finishCheckoutSuccess]);

  /** Enter matches Next / Enter Letora: inputs submit the step; step 1 advances when a focus is chosen. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.repeat || e.defaultPrevented) return;
      if (identityBusy || focusBusy || propertyBusy || skipBusy) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest("textarea")) return;
      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;

      if (target instanceof HTMLInputElement) {
        if (step === 0 && portfolioName.trim().length >= 2) {
          e.preventDefault();
          void submitIdentity();
        }
        if (step === 2 && addressLine.trim().length >= 5) {
          e.preventDefault();
          void submitProperty();
        }
        return;
      }

      if (step === 0 && portfolioName.trim().length >= 2) {
        e.preventDefault();
        void submitIdentity();
      } else if (step === 1 && focus) {
        e.preventDefault();
        void submitFocusAndContinue();
      } else if (step === 2 && addressLine.trim().length >= 5) {
        e.preventDefault();
        void submitProperty();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // submit* are stable enough per render; step + fields drive behavior
  }, [
    step,
    portfolioName,
    focus,
    addressLine,
    identityBusy,
    focusBusy,
    propertyBusy,
    skipBusy,
  ]);

  async function handleSkipForNow() {
    setSkipBusy(true);
    try {
      const res = await skipOnboarding();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setSkipBusy(false);
    }
  }

  async function submitIdentity() {
    setIdentityBusy(true);
    try {
      const res = await saveOnboardingIdentity({ portfolioName });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDir(1);
      setStep(1);
    } finally {
      setIdentityBusy(false);
    }
  }

  async function submitFocusAndContinue() {
    if (!focus) {
      toast.error("Choose what you want to focus on first.");
      return;
    }
    setFocusBusy(true);
    try {
      const res = await saveOnboardingFocus({ focus });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDir(1);
      setStep(2);
    } finally {
      setFocusBusy(false);
    }
  }

  async function submitProperty() {
    setPropertyBusy(true);
    try {
      const res = await completeOnboardingWithProperty(addressLine);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setPropertyBusy(false);
    }
  }

  function back() {
    if (step === 0) return;
    setDir(-1);
    setStep((s) => (s - 1) as 0 | 1 | 2);
  }

  const progress = ((step + 1) / 3) * 100;
  const progressValue = Math.round(progress);

  return (
    <div className="relative min-h-svh overflow-hidden bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]">
        <div className="absolute inset-0 bg-[#0a0a0a]" aria-hidden />
        <div
          className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 bg-gradient-to-r from-transparent via-[#BD9952]/22 to-transparent opacity-80 blur-md"
          aria-hidden
        />
        <div className="relative h-[2px] w-full overflow-hidden">
          <motion.div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressValue}
            aria-valuetext={`Step ${step + 1} of 3`}
            aria-label="Setup progress"
            className="absolute inset-y-0 left-0 h-full rounded-none bg-gradient-to-r from-[#6e5a2a] via-[#BD9952] to-[#f5edd8]"
            style={{
              boxShadow:
                "0 0 10px 1px rgba(189, 153, 82, 0.5), 0 0 24px 2px rgba(189, 153, 82, 0.18)",
            }}
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 28 }}
          />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 55% at 50% -15%, rgba(189,153,82,0.11), transparent 58%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-3xl flex-col px-6 pt-16 pb-6 md:px-12 md:pt-24">
        <header className="mb-14 flex items-center gap-4">
          <span className="font-headline text-[0.6rem] font-medium uppercase tracking-[0.38em] text-zinc-600">
            Letora
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/90 to-transparent" aria-hidden />
        </header>

        <div className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait" custom={dir}>
            {step === 0 ? (
              <motion.section
                key="identity"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
                className="space-y-12"
              >
                <div className="space-y-5">
                  <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#BD9952]/90">
                    Identity
                  </p>
                  <h1 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-white md:text-5xl">
                    Your company or portfolio name
                  </h1>
                  <p className="max-w-lg font-headline text-base font-light leading-relaxed text-zinc-500">
                    This is how your workspace is labelled across Letora — you can refine details later in Settings.
                  </p>
                </div>

                <div>
                  <label htmlFor="portfolio-name" className="sr-only">
                    Company or portfolio name
                  </label>
                  <Input
                    id="portfolio-name"
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    placeholder="e.g. Meridian Street Holdings"
                    className="h-16 border-zinc-800 bg-zinc-950/40 px-6 font-headline text-xl font-light tracking-tight text-white placeholder:text-zinc-600 focus-visible:border-[#BD9952]/45 focus-visible:ring-2 focus-visible:ring-[#BD9952]/15"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    disabled={identityBusy || portfolioName.trim().length < 2}
                    onClick={() => void submitIdentity()}
                    className={cn("h-14 rounded-full px-10 font-headline text-xs font-semibold uppercase tracking-[0.22em]", nextGlow)}
                  >
                    {identityBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <>
                        Next
                        <ArrowRight className="ml-2 size-4 opacity-90" aria-hidden />
                      </>
                    )}
                  </Button>
                </div>
              </motion.section>
            ) : null}

            {step === 1 ? (
              <motion.section
                key="focus"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
                className="space-y-12"
              >
                <div className="space-y-5">
                  <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#BD9952]/90">
                    Focus
                  </p>
                  <h2 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-white md:text-5xl">
                    What should we prioritise?
                  </h2>
                  <p className="max-w-xl font-headline text-base font-light text-zinc-500">
                    We tune defaults and prompts to match how you work — pick one to start.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-1">
                  {FOCUS_OPTIONS.map((opt) => {
                    const selected = focus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFocus(opt.id)}
                        className={cn(
                          "group flex min-h-[8.5rem] flex-col justify-between rounded-2xl border px-8 py-8 text-left transition-colors md:min-h-[9.5rem]",
                          selected
                            ? "border-[#BD9952]/50 bg-[#BD9952]/[0.06]"
                            : "border-zinc-800/90 bg-transparent hover:border-zinc-700",
                        )}
                      >
                        <span className="flex items-start justify-between gap-4">
                          <span className="font-headline text-2xl font-light tracking-tight text-white md:text-[1.65rem]">
                            {opt.title}
                          </span>
                          <span
                            className={cn(
                              "mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border",
                              selected
                                ? "border-[#BD9952] bg-[#BD9952]/15 text-[#BD9952]"
                                : "border-zinc-700 text-transparent",
                            )}
                          >
                            <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                          </span>
                        </span>
                        <span className="mt-4 font-headline text-sm font-light leading-relaxed text-zinc-500">
                          {opt.line}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <button
                    type="button"
                    onClick={back}
                    className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    Back
                  </button>
                  <Button
                    type="button"
                    disabled={focusBusy || !focus}
                    onClick={() => void submitFocusAndContinue()}
                    className={cn("h-14 rounded-full px-10 font-headline text-xs font-semibold uppercase tracking-[0.22em]", nextGlow)}
                  >
                    {focusBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <>
                        Next
                        <ArrowRight className="ml-2 size-4 opacity-90" aria-hidden />
                      </>
                    )}
                  </Button>
                </div>
              </motion.section>
            ) : null}

            {step === 2 ? (
              <motion.section
                key="property"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
                className="space-y-12"
              >
                <div className="space-y-5">
                  <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#BD9952]/90">
                    First property
                  </p>
                  <h2 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-white md:text-5xl">
                    Add an address
                  </h2>
                  <p className="max-w-xl font-headline text-base font-light text-zinc-500">
                    We create the property and wire compliance and rent around it. You can edit everything next in your
                    portfolio.
                  </p>
                </div>

                <div className="space-y-4">
                  <label htmlFor="quick-address" className="sr-only">
                    Property address
                  </label>
                  <Input
                    id="quick-address"
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    placeholder="Street, city, postcode…"
                    className="h-16 border-zinc-800 bg-zinc-950/40 px-6 font-headline text-lg font-light text-white placeholder:text-zinc-600 focus-visible:border-[#BD9952]/45 focus-visible:ring-2 focus-visible:ring-[#BD9952]/15"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <button
                    type="button"
                    onClick={back}
                    className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    Back
                  </button>
                  <Button
                    type="button"
                    disabled={propertyBusy || addressLine.trim().length < 5}
                    onClick={() => void submitProperty()}
                    className={cn("h-14 rounded-full px-10 font-headline text-xs font-semibold uppercase tracking-[0.22em]", nextGlow)}
                  >
                    {propertyBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <>
                        Enter Letora
                        <ArrowRight className="ml-2 size-4 opacity-90" aria-hidden />
                      </>
                    )}
                  </Button>
                </div>
              </motion.section>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-auto flex shrink-0 justify-center pt-10 pb-2 md:pt-14 md:pb-4">
          <button
            type="button"
            aria-label="Skip onboarding and open the dashboard"
            disabled={skipBusy || identityBusy || focusBusy || propertyBusy}
            onClick={() => void handleSkipForNow()}
            className="font-headline text-[0.6875rem] font-light tracking-[0.04em] text-zinc-500 transition-colors hover:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {skipBusy ? "Opening…" : "Skip for now"}
          </button>
        </div>
      </div>
    </div>
  );
}
