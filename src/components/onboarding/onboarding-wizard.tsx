"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronRight, Home, Loader2, Sprout, TrendingUp, Users } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { saveOrganisationSettings, saveProfileSettings } from "@/app/(dashboard)/dashboard/settings/actions";
import {
  completeOnboarding,
  saveLandlordType,
  saveOnboardingStep,
} from "@/app/(dashboard)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type LandlordType,
  LANDLORD_ONBOARDING_WIZARD_STEP_COUNT,
  LANDLORD_ONBOARDING_WIZARD_STEPS,
  type OnboardingWizardStep,
} from "@/lib/onboarding/landlord-wizard";
import { cn } from "@/lib/utils";

export type { OnboardingWizardStep };

const TEAL_RING = "focus-visible:ring-[#01696f]/40";

const LANDLORD_TYPE_CARDS: {
  id: LandlordType;
  title: string;
  description: string;
  Icon: typeof Home;
}[] = [
  {
    id: "self_managed",
    title: "Self-managed",
    description: "I run my own lets day to day — Letora automates the busywork.",
    Icon: Home,
  },
  {
    id: "portfolio",
    title: "Growing portfolio",
    description: "Multiple properties — I need rent, compliance, and comms in one place.",
    Icon: TrendingUp,
  },
  {
    id: "agent",
    title: "Letting agent",
    description: "I act for landlords — approvals and drafts should match our brand.",
    Icon: Users,
  },
  {
    id: "new_landlord",
    title: "New landlord",
    description: "Early stage — I want guided setup and clear next steps.",
    Icon: Sprout,
  },
];

const LEFT_COPY: Record<
  OnboardingWizardStep,
  { kicker: string; title: string; body: string }
> = {
  1: {
    kicker: "Step 1",
    title: "Who’s behind this workspace?",
    body: "Your name and organisation power contracts, emails, and the assistant — you can refine everything later in Settings.",
  },
  2: {
    kicker: "Step 2",
    title: "How do you operate?",
    body: "We tune defaults and language around how you work — solo, scaling, agency, or just getting started.",
  },
  3: {
    kicker: "Step 3",
    title: "Pick your first move",
    body: "Import a portfolio, open tenants, or jump into compliance. Finish anytime — your dashboard is ready.",
  },
};

export function OnboardingWizard({
  initialStep,
  initialOrgName = "",
  initialFirstName = "",
  initialLastName = "",
  initialLandlordType = null,
  userEmail,
}: {
  initialStep: OnboardingWizardStep;
  initialOrgName?: string;
  initialFirstName?: string;
  initialLastName?: string;
  initialLandlordType?: LandlordType | null;
  userEmail?: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<OnboardingWizardStep>(initialStep);
  const [slideDir, setSlideDir] = useState(1);

  const [orgName, setOrgName] = useState(initialOrgName);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [landlordType, setLandlordType] = useState<LandlordType | null>(initialLandlordType);

  const [step1Busy, setStep1Busy] = useState(false);
  const [step2Busy, setStep2Busy] = useState(false);
  const [completeBusy, setCompleteBusy] = useState<string | null>(null);

  const progressRatio = step / LANDLORD_ONBOARDING_WIZARD_STEP_COUNT;
  const progressPct = Math.round(progressRatio * 100);

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0, 0, 0.2, 1] as [number, number, number, number] };

  const slideVariants = reduceMotion
    ? {
        enter: { x: 0, opacity: 1 },
        center: { x: 0, opacity: 1 },
        exit: { x: 0, opacity: 1 },
      }
    : {
        enter: (dir: number) => ({ x: dir >= 0 ? 32 : -32, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir >= 0 ? -32 : 32, opacity: 0 }),
      };

  const goBack = useCallback(() => {
    if (step <= 1) return;
    const next = (step - 1) as OnboardingWizardStep;
    setSlideDir(-1);
    if (step === 3) void saveOnboardingStep(2);
    else if (step === 2) void saveOnboardingStep(1);
    setStep(next);
  }, [step]);

  const canSubmitStep1 =
    orgName.trim().length >= 1 && firstName.trim().length >= 1 && lastName.trim().length >= 1;

  async function submitStep1() {
    if (!canSubmitStep1) {
      toast.error("Enter your organisation name, first name, and last name.");
      return;
    }
    setStep1Busy(true);
    try {
      const orgRes = await saveOrganisationSettings({
        orgName: orgName.trim(),
        orgLogoUrl: "",
        orgContactEmail: "",
        orgPhone: "",
        orgAddress: "",
      });
      if (orgRes.success === false) {
        toast.error(orgRes.error);
        return;
      }
      const profileRes = await saveProfileSettings({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarUrl: "",
      });
      if (profileRes.success === false) {
        toast.error(profileRes.error);
        return;
      }
      const stepRes = await saveOnboardingStep(2);
      if (stepRes.ok === false) {
        toast.error(stepRes.error);
        return;
      }
      setSlideDir(1);
      setStep(2);
    } finally {
      setStep1Busy(false);
    }
  }

  async function submitStep2() {
    if (!landlordType) {
      toast.error("Choose how you operate.");
      return;
    }
    setStep2Busy(true);
    try {
      const typeRes = await saveLandlordType(landlordType);
      if (typeRes.ok === false) {
        toast.error(typeRes.error);
        return;
      }
      const stepRes = await saveOnboardingStep(3);
      if (stepRes.ok === false) {
        toast.error(stepRes.error);
        return;
      }
      setSlideDir(1);
      setStep(3);
    } finally {
      setStep2Busy(false);
    }
  }

  async function finishAndGo(href: string, key: string) {
    if (completeBusy) return;
    setCompleteBusy(key);
    try {
      const done = await completeOnboarding();
      if (done.ok === false) {
        toast.error(done.error);
        return;
      }
      router.push(href);
      router.refresh();
    } finally {
      setCompleteBusy(null);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.repeat || e.defaultPrevented) return;
      if (step1Busy || step2Busy || completeBusy) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("textarea")) return;
      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;

      if (step === 1 && canSubmitStep1 && target instanceof HTMLInputElement) {
        e.preventDefault();
        void submitStep1();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: submitStep1 closes over latest fields
  }, [step, step1Busy, step2Busy, completeBusy, canSubmitStep1, orgName, firstName, lastName]);

  const left = LEFT_COPY[step];
  const busy = Boolean(completeBusy);

  return (
    <div className="flex min-h-svh flex-col bg-background md:flex-row">
      <aside
        className={cn(
          "relative hidden flex-col justify-between px-10 py-12 text-white md:flex md:w-[40%]",
          "bg-[#01696f] dark:bg-[#4f98a3]",
        )}
      >
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/letora-logo-dark.svg"
              alt="Letora"
              width={140}
              height={32}
              className="h-8 w-auto opacity-95"
              priority
              unoptimized
            />
          </div>
          <p className="mt-10 font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#97e6ec]/90">
            {left.kicker}
          </p>
          <h1 className="mt-3 max-w-md font-[family-name:var(--font-inter)] text-3xl font-light leading-tight tracking-tight">
            {left.title}
          </h1>
          <p className="mt-4 max-w-sm font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-white/85">
            {left.body}
          </p>
        </div>
        {userEmail ? (
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">{userEmail}</p>
        ) : null}
      </aside>

      <div className="flex min-h-svh flex-1 flex-col md:w-[60%]">
        <div className="border-b border-border px-4 py-4 md:px-10 md:py-6">
          <div className="flex items-center justify-between gap-4 md:hidden">
            <Image
              src="/letora-logo.svg"
              alt="Letora"
              width={120}
              height={28}
              className="h-7 w-auto dark:hidden"
              priority
              unoptimized
            />
            <Image
              src="/letora-logo-dark.svg"
              alt="Letora"
              width={120}
              height={28}
              className="hidden h-7 w-auto dark:block"
              priority
              unoptimized
            />
          </div>

          <div className="mt-4 md:mt-0">
            <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPct}
                aria-valuetext={`Step ${step} of ${LANDLORD_ONBOARDING_WIZARD_STEP_COUNT}`}
                aria-label="Setup progress"
                className="h-full rounded-full bg-[#01696f] dark:bg-[#4f98a3]"
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
              />
            </div>

            <div className="flex items-start justify-center gap-0 px-2 sm:px-6" aria-label="Onboarding steps">
              {[1, 2, 3].map((n, idx) => {
                const done = step > n;
                const active = step === n;
                const showLine = idx < 2;
                return (
                  <div key={n} className="flex min-w-0 flex-1 items-start justify-center last:flex-none last:w-auto">
                    <div className="flex w-full max-w-[7rem] flex-col items-center gap-2">
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors",
                          done || active
                            ? "border-[#01696f] bg-[#01696f] text-white dark:border-white/30 dark:bg-white/20 dark:text-white"
                            : "border-muted-foreground/25 bg-background text-muted-foreground",
                          active && "onboarding-step-dot--pulse",
                        )}
                        aria-current={active ? "step" : undefined}
                      >
                        {done ? "✓" : n}
                      </div>
                      <span className="hidden text-center font-mono text-[9px] uppercase tracking-wider text-muted-foreground sm:block">
                        {LANDLORD_ONBOARDING_WIZARD_STEPS[idx]}
                      </span>
                    </div>
                    {showLine ? (
                      <div
                        className="mx-1 mt-[1.125rem] h-0.5 min-w-[1rem] flex-1 rounded-full bg-muted"
                        aria-hidden
                      >
                        <div
                          className={cn(
                            "h-full rounded-full bg-[#01696f] dark:bg-[#4f98a3]",
                            reduceMotion ? "" : "transition-[width] duration-200 ease-out",
                          )}
                          style={{ width: step > n ? "100%" : "0%" }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col px-4 py-8 md:px-10 md:py-12">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Step {step} of {LANDLORD_ONBOARDING_WIZARD_STEP_COUNT}
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-inter)] text-2xl font-light tracking-tight text-foreground md:text-3xl">
            {LANDLORD_ONBOARDING_WIZARD_STEPS[step - 1]}
          </h2>

          <div className="relative mt-8 min-h-[12rem] flex-1">
            <AnimatePresence mode="wait" custom={slideDir}>
              {step === 1 ? (
                <motion.div
                  key="s1"
                  custom={slideDir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={transition}
                  className="mx-auto max-w-lg space-y-6"
                >
                  <div className="space-y-2">
                    <Label htmlFor="ob-org">Organisation name</Label>
                    <Input
                      id="ob-org"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      autoComplete="organization"
                      placeholder="e.g. Meridian Street Holdings"
                      className={cn(TEAL_RING)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ob-first">First name</Label>
                      <Input
                        id="ob-first"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                        placeholder="Jane"
                        className={cn(TEAL_RING)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ob-last">Last name</Label>
                      <Input
                        id="ob-last"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        autoComplete="family-name"
                        placeholder="Smith"
                        className={cn(TEAL_RING)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                    <span className="text-sm text-muted-foreground" aria-hidden />
                    <Button
                      type="button"
                      disabled={step1Busy || !canSubmitStep1}
                      onClick={() => void submitStep1()}
                      className="rounded-full bg-[#01696f] px-8 text-primary-foreground hover:bg-[#015a5f] dark:bg-[#4f98a3] dark:text-white dark:hover:bg-[#458892]"
                    >
                      {step1Busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="ml-2 size-4" aria-hidden />
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 2 ? (
                <motion.div
                  key="s2"
                  custom={slideDir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={transition}
                  className="mx-auto max-w-2xl space-y-8"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {LANDLORD_TYPE_CARDS.map(({ id, title, description, Icon }) => {
                      const selected = landlordType === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setLandlordType(id)}
                          className={cn(
                            "flex flex-col rounded-xl border p-5 text-left transition-colors",
                            selected
                              ? "border-[#01696f] bg-[#01696f]/5 ring-2 ring-[#01696f]/25 dark:border-[#4f98a3] dark:bg-[#4f98a3]/10 dark:ring-[#4f98a3]/25"
                              : "border-border hover:border-muted-foreground/30",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-6",
                              selected ? "text-[#01696f] dark:text-[#4f98a3]" : "text-muted-foreground",
                            )}
                            aria-hidden
                          />
                          <span className="mt-3 font-medium text-foreground">{title}</span>
                          <span className="mt-1 text-sm text-muted-foreground">{description}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={goBack}
                      className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Back
                    </button>
                    <Button
                      type="button"
                      disabled={step2Busy || !landlordType}
                      onClick={() => void submitStep2()}
                      className="rounded-full bg-[#01696f] px-8 text-primary-foreground hover:bg-[#015a5f] dark:bg-[#4f98a3] dark:text-white dark:hover:bg-[#458892]"
                    >
                      {step2Busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="ml-2 size-4" aria-hidden />
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 3 ? (
                <motion.div
                  key="s3"
                  custom={slideDir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={transition}
                  className="mx-auto max-w-lg space-y-4"
                >
                  <p className="text-sm text-muted-foreground">
                    You can open the dashboard now, or jump straight into a workflow below.
                  </p>
                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {(
                      [
                        {
                          key: "import",
                          label: "Import portfolio",
                          hint: "CSV or spreadsheet — we stage properties for review.",
                          href: "/dashboard/portfolio?import=true",
                        },
                        {
                          key: "tenants",
                          label: "Tenants",
                          hint: "Profiles, tenancies, and comms in one place.",
                          href: "/dashboard/tenants",
                        },
                        {
                          key: "compliance",
                          label: "Compliance",
                          hint: "Right to Rent and record keeping reminders.",
                          href: "/dashboard/compliance",
                        },
                      ] as const
                    ).map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        disabled={busy}
                        onClick={() => void finishAndGo(row.href, row.key)}
                        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">{row.label}</p>
                          <p className="text-sm text-muted-foreground">{row.hint}</p>
                        </div>
                        {completeBusy === row.key ? (
                          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={busy}
                      className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                    >
                      Back
                    </button>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void finishAndGo("/dashboard?postSetup=1", "home")}
                      className="rounded-full bg-[#01696f] px-8 text-primary-foreground hover:bg-[#015a5f] dark:bg-[#4f98a3] dark:text-white dark:hover:bg-[#458892]"
                    >
                      {completeBusy === "home" ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          Enter dashboard
                          <ArrowRight className="ml-2 size-4" aria-hidden />
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
