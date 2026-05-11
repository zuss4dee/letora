"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AddressMapPicker } from "@/components/address/address-map-picker";
import { PlacesStreetAutocomplete } from "@/components/address/places-street-autocomplete";
import { isGoogleMapsConfigured } from "@/components/address/load-google-maps";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  completeOnboardingGate,
  completeOnboardingWithProperty,
  saveOnboardingFocus,
  saveOnboardingIdentity,
  saveOnboardingSettingsEssentials,
  skipOnboarding,
} from "@/lib/actions/user-onboarding";
import {
  LANDLORD_ONBOARDING_WIZARD_LAST_STEP_INDEX,
  LANDLORD_ONBOARDING_WIZARD_STEP_COUNT,
  LANDLORD_ONBOARDING_WIZARD_STEPS,
  type OnboardingWizardStep,
} from "@/lib/onboarding/landlord-wizard";
import {
  FOCUS_OPTIONS,
  MAX_ONBOARDING_PRIORITIES,
  parseStoredPrimaryGoals,
  type FocusOptionId,
} from "@/lib/onboarding/priorities";
import { isValidEmailOrEmpty } from "@/lib/validations/email";
import { cn } from "@/lib/utils";

const nextGlow =
  "bg-white text-black shadow-[0_0_22px_-2px_rgba(255,255,255,0.25)] transition-[box-shadow,transform] hover:shadow-[0_0_32px_-2px_rgba(255,255,255,0.35)] hover:brightness-[0.9] active:scale-[0.99] disabled:opacity-50 disabled:shadow-none";

/** Empty is allowed; non-empty must be a valid email (server Zod is authoritative). */
function isOptionalEmailFieldOk(value: string): boolean {
  return isValidEmailOrEmpty(value);
}

function canProceedSettingsStep(
  landlordName: string,
  contactEmail: string,
  referencingAgencyEmail: string,
  noAgencyOrReferencing: boolean,
): boolean {
  if (landlordName.trim().length < 2) return false;
  if (noAgencyOrReferencing) return true;
  return isOptionalEmailFieldOk(contactEmail) && isOptionalEmailFieldOk(referencingAgencyEmail);
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? -40 : 40, opacity: 0 }),
};

export type { OnboardingWizardStep };

export function OnboardingWizard({
  initialStep,
  defaultPortfolioName = "",
  storedPrimaryGoal = null,
  defaultLandlordName = "",
  defaultContactEmail = "",
  defaultReferencingAgencyEmail = "",
}: {
  initialStep: OnboardingWizardStep;
  defaultPortfolioName?: string;
  storedPrimaryGoal?: string | null;
  defaultLandlordName?: string;
  defaultContactEmail?: string;
  defaultReferencingAgencyEmail?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutHandled = useRef(false);
  const [step, setStep] = useState(initialStep);
  const [dir, setDir] = useState(0);

  const [portfolioName, setPortfolioName] = useState(defaultPortfolioName);
  const [selectedPriorities, setSelectedPriorities] = useState<FocusOptionId[]>(() =>
    parseStoredPrimaryGoals(storedPrimaryGoal),
  );
  const [identityBusy, setIdentityBusy] = useState(false);
  const [focusBusy, setFocusBusy] = useState(false);

  const [landlordName, setLandlordName] = useState(defaultLandlordName);
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);
  const [referencingAgencyEmail, setReferencingAgencyEmail] = useState(defaultReferencingAgencyEmail);
  const [noAgencyOrReferencing, setNoAgencyOrReferencing] = useState(
    () => !defaultContactEmail.trim() && !defaultReferencingAgencyEmail.trim(),
  );
  const [settingsBusy, setSettingsBusy] = useState(false);

  const [propertyStreet, setPropertyStreet] = useState("");
  const [propertyCity, setPropertyCity] = useState("");
  const [propertyPostcode, setPropertyPostcode] = useState("");
  const [addressManualOnly, setAddressManualOnly] = useState(() => !isGoogleMapsConfigured());
  const [propertyBusy, setPropertyBusy] = useState(false);

  const [skipBusy, setSkipBusy] = useState(false);

  const finishCheckoutSuccess = useCallback(async () => {
    const res = await completeOnboardingGate();
    if (res.ok === false) {
      toast.error(res.error);
      return;
    }
    toast.success("Payment received. Continue setup below.");
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
      if (identityBusy || focusBusy || settingsBusy || propertyBusy) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest("textarea")) return;
      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;

      if (target instanceof HTMLInputElement) {
        if (step === 0 && portfolioName.trim().length >= 2) {
          e.preventDefault();
          void submitIdentity();
        }
        if (step === 2 && canProceedSettingsStep(landlordName, contactEmail, referencingAgencyEmail, noAgencyOrReferencing)) {
          e.preventDefault();
          void submitSettings();
        }
        if (
          step === LANDLORD_ONBOARDING_WIZARD_LAST_STEP_INDEX &&
          propertyStreet.trim().length >= 1 &&
          propertyCity.trim().length >= 1 &&
          propertyPostcode.trim().length >= 1
        ) {
          e.preventDefault();
          void submitProperty();
        }
        return;
      }

      if (step === 0 && portfolioName.trim().length >= 2) {
        e.preventDefault();
        void submitIdentity();
      } else if (step === 1 && selectedPriorities.length > 0) {
        e.preventDefault();
        void submitFocusAndContinue();
      } else if (step === 2 && canProceedSettingsStep(landlordName, contactEmail, referencingAgencyEmail, noAgencyOrReferencing)) {
        e.preventDefault();
        void submitSettings();
      } else if (
        step === LANDLORD_ONBOARDING_WIZARD_LAST_STEP_INDEX &&
        propertyStreet.trim().length >= 1 &&
        propertyCity.trim().length >= 1 &&
        propertyPostcode.trim().length >= 1
      ) {
        e.preventDefault();
        void submitProperty();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // submit* are stable enough per render; step + fields drive behavior
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit handlers intentionally omitted; keyed by step + fields
  }, [
    step,
    portfolioName,
    selectedPriorities,
    propertyStreet,
    propertyCity,
    propertyPostcode,
    identityBusy,
    focusBusy,
    settingsBusy,
    propertyBusy,
    landlordName,
    contactEmail,
    referencingAgencyEmail,
    noAgencyOrReferencing,
  ]);

  async function submitIdentity() {
    setIdentityBusy(true);
    try {
      const res = await saveOnboardingIdentity({ portfolioName });
      if (res.ok === false) {
        toast.error(res.error);
        return;
      }
      setDir(1);
      setStep(1);
    } finally {
      setIdentityBusy(false);
    }
  }

  function togglePriority(id: FocusOptionId) {
    setSelectedPriorities((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_ONBOARDING_PRIORITIES) {
        toast.info(`You can select up to ${MAX_ONBOARDING_PRIORITIES} priorities.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  async function submitFocusAndContinue() {
    if (selectedPriorities.length === 0) {
      toast.error("Choose at least one priority.");
      return;
    }
    setFocusBusy(true);
    try {
      const res = await saveOnboardingFocus({ focusIds: selectedPriorities });
      if (res.ok === false) {
        toast.error(res.error);
        return;
      }
      setDir(1);
      setStep(2);
    } finally {
      setFocusBusy(false);
    }
  }

  async function submitSettings() {
    setSettingsBusy(true);
    try {
      const res = await saveOnboardingSettingsEssentials({
        portfolioName,
        landlordName,
        contactEmail: noAgencyOrReferencing ? "" : contactEmail,
        referencingAgencyEmail: noAgencyOrReferencing ? "" : referencingAgencyEmail,
      });
      if (res.ok === false) {
        toast.error(res.error);
        return;
      }
      setDir(1);
      setStep(LANDLORD_ONBOARDING_WIZARD_LAST_STEP_INDEX);
    } finally {
      setSettingsBusy(false);
    }
  }

  async function submitProperty() {
    if (!propertyStreet.trim() || !propertyCity.trim() || !propertyPostcode.trim()) {
      toast.error("Enter street, city, and postcode.");
      return;
    }
    setPropertyBusy(true);
    try {
      const res = await completeOnboardingWithProperty({
        address: propertyStreet.trim(),
        city: propertyCity.trim(),
        postcode: propertyPostcode.trim(),
      });
      if (res.ok === false) {
        toast.error(res.error);
        return;
      }
      toast.success("Welcome — opening your dashboard.");
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setPropertyBusy(false);
    }
  }

  const stepBusy = identityBusy || focusBusy || settingsBusy || propertyBusy;

  async function handleSkipOnboarding() {
    if (skipBusy || stepBusy) return;
    setSkipBusy(true);
    try {
      const res = await skipOnboarding();
      if (res.ok === false) {
        toast.error(res.error);
        return;
      }
      toast.info("You can finish setup from the dashboard checklist.");
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setSkipBusy(false);
    }
  }

  function back() {
    if (step === 0) return;
    setDir(-1);
    setStep((s) => (s - 1) as OnboardingWizardStep);
  }

  const progress = ((step + 1) / LANDLORD_ONBOARDING_WIZARD_STEP_COUNT) * 100;
  const progressValue = Math.round(progress);
  const stepsRemainingAfter = LANDLORD_ONBOARDING_WIZARD_STEP_COUNT - (step + 1);

  const onboardingInputClass =
    "h-12 border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 px-4 font-headline text-base font-light text-white placeholder:text-zinc-600 focus-visible:border-white focus-visible:ring-2 focus-visible:ring-white/20";

  const canSubmitProperty =
    propertyStreet.trim().length >= 1 &&
    propertyCity.trim().length >= 1 &&
    propertyPostcode.trim().length >= 1;

  const canSubmitSettings = canProceedSettingsStep(
    landlordName,
    contactEmail,
    referencingAgencyEmail,
    noAgencyOrReferencing,
  );

  return (
    <div className="relative min-h-svh overflow-hidden bg-zinc-950 dark:bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]">
        <div className="absolute inset-0 bg-background dark:bg-[#0a0a0a]" aria-hidden />
        <div
          className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-80 blur-md"
          aria-hidden
        />
        <div className="relative h-[2px] w-full overflow-hidden">
          <motion.div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressValue}
            aria-valuetext={`Step ${step + 1} of ${LANDLORD_ONBOARDING_WIZARD_STEP_COUNT}`}
            aria-label="Setup progress"
            className="absolute inset-y-0 left-0 h-full rounded-none bg-gradient-to-r from-zinc-700 via-zinc-400 to-white"
            style={{
              boxShadow:
                "0 0 10px 1px rgba(255, 255, 255, 0.3), 0 0 24px 2px rgba(255, 255, 255, 0.1)",
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
            "radial-gradient(ellipse 85% 55% at 50% -15%, rgba(255,255,255,0.06), transparent 58%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-3xl flex-col px-6 pt-16 pb-6 md:px-12 md:pt-24">
        <header className="mb-10 flex flex-col gap-3 md:mb-14">
          <div className="flex items-center gap-4">
            <span className="font-headline text-[0.6rem] font-medium uppercase tracking-[0.38em] text-zinc-600">
              Letora
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/90 to-transparent" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-zinc-400">
              Step {step + 1} of {LANDLORD_ONBOARDING_WIZARD_STEP_COUNT} · {LANDLORD_ONBOARDING_WIZARD_STEPS[step]}
            </p>
            <p className="font-headline text-xs font-light text-zinc-500">
              {stepsRemainingAfter <= 0
                ? "Last step — then you are in your dashboard."
                : `${stepsRemainingAfter} more step${stepsRemainingAfter === 1 ? "" : "s"} after this one (about ${stepsRemainingAfter + 1}–${stepsRemainingAfter + 3} minutes in total).`}
            </p>
          </div>
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
                  <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-zinc-400">
                    Identity
                  </p>
                  <h1 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-zinc-900 dark:text-white md:text-5xl">
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
                    className="h-16 border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 px-6 font-headline text-xl font-light tracking-tight text-white placeholder:text-zinc-600 focus-visible:border-white focus-visible:ring-2 focus-visible:ring-white/20"
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
                  <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-zinc-400">
                    Priorities
                  </p>
                  <h2 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-zinc-900 dark:text-white md:text-5xl">
                    What should we prioritise?
                  </h2>
                  <p className="max-w-xl font-headline text-base font-light text-zinc-500">
                    Choose at least one and up to {MAX_ONBOARDING_PRIORITIES} areas — we tune defaults and assistant
                    behaviour around your selections. Tap again to remove.
                  </p>
                  <p className="font-headline text-sm font-medium text-zinc-400" aria-live="polite">
                    {selectedPriorities.length}/{MAX_ONBOARDING_PRIORITIES} selected
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {FOCUS_OPTIONS.map((opt) => {
                    const selected = selectedPriorities.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => togglePriority(opt.id)}
                        className={cn(
                          "group flex min-h-[7.5rem] flex-col justify-between rounded-2xl border px-6 py-6 text-left transition-colors sm:min-h-[8.25rem]",
                          selected
                            ? "border-white/50 bg-white/[0.06]"
                            : "border-zinc-800/90 bg-transparent hover:border-zinc-700",
                        )}
                      >
                        <span className="flex items-start justify-between gap-4">
                          <span className="font-headline text-xl font-light tracking-tight text-zinc-900 dark:text-white md:text-[1.35rem]">
                            {opt.title}
                          </span>
                          <span
                            className={cn(
                              "mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border",
                              selected
                                ? "border-white bg-white/15 text-zinc-900 dark:text-white"
                                : "border-zinc-700 text-transparent",
                            )}
                          >
                            <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                          </span>
                        </span>
                        <span className="mt-3 font-headline text-sm font-light leading-relaxed text-zinc-500">
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
                    className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Back
                  </button>
                  <Button
                    type="button"
                    disabled={focusBusy || selectedPriorities.length === 0}
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
                key="settings"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
                className="space-y-12"
              >
                <div className="space-y-5">
                  <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-zinc-400">
                    Essentials
                  </p>
                  <h2 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-zinc-900 dark:text-white md:text-5xl">
                    Landlord &amp; agency details
                  </h2>
                  <p className="max-w-xl font-headline text-base font-light text-zinc-500">
                    We use these on notices, referencing, and outbound email. You can refine everything later in Settings.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ob-landlord" className="font-headline text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500">
                      Full landlord / legal name{" "}
                      <span className="normal-case tracking-normal text-zinc-400">(required)</span>
                    </Label>
                    <Input
                      id="ob-landlord"
                      value={landlordName}
                      onChange={(e) => setLandlordName(e.target.value)}
                      autoComplete="name"
                      placeholder="e.g. Jane Smith"
                      className={onboardingInputClass}
                      required
                      aria-required
                    />
                  </div>

                  <div className="flex gap-3 rounded-lg border border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/30 px-4 py-3">
                    <Checkbox
                      id="ob-no-agency"
                      checked={noAgencyOrReferencing}
                      onCheckedChange={(c) => {
                        const on = c === true;
                        setNoAgencyOrReferencing(on);
                        if (on) {
                          setContactEmail("");
                          setReferencingAgencyEmail("");
                        }
                      }}
                      className="mt-0.5 border-zinc-600 data-checked:border-white data-checked:bg-white data-checked:text-black"
                    />
                    <label htmlFor="ob-no-agency" className="cursor-pointer font-headline text-sm font-light leading-snug text-zinc-700 dark:text-zinc-300">
                      I don&apos;t have an agency or separate referencing contact
                      <span className="mt-1 block text-xs text-zinc-500">
                        You can add these later in Settings. Your landlord name is still required.
                      </span>
                    </label>
                  </div>

                  <div
                    className={cn(
                      "space-y-4 transition-opacity",
                      noAgencyOrReferencing ? "pointer-events-none opacity-40" : "",
                    )}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="ob-contact-email" className="font-headline text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500">
                        Agency contact email
                        <span className="ml-1.5 normal-case tracking-normal text-zinc-600">(optional)</span>
                      </Label>
                      <Input
                        id="ob-contact-email"
                        type="email"
                        value={contactEmail}
                        onChange={(e) => {
                          setNoAgencyOrReferencing(false);
                          setContactEmail(e.target.value);
                        }}
                        autoComplete="email"
                        placeholder="e.g. office@youragency.co.uk"
                        className={onboardingInputClass}
                        disabled={noAgencyOrReferencing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ob-ref-email" className="font-headline text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500">
                        Referencing contact email
                        <span className="ml-1.5 normal-case tracking-normal text-zinc-600">(optional)</span>
                      </Label>
                      <Input
                        id="ob-ref-email"
                        type="email"
                        value={referencingAgencyEmail}
                        onChange={(e) => {
                          setNoAgencyOrReferencing(false);
                          setReferencingAgencyEmail(e.target.value);
                        }}
                        autoComplete="email"
                        placeholder="e.g. referencing@youragency.co.uk"
                        className={onboardingInputClass}
                        disabled={noAgencyOrReferencing}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <button
                    type="button"
                    onClick={back}
                    className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Back
                  </button>
                  <Button
                    type="button"
                    disabled={settingsBusy || !canSubmitSettings}
                    onClick={() => void submitSettings()}
                    className={cn("h-14 rounded-full px-10 font-headline text-xs font-semibold uppercase tracking-[0.22em]", nextGlow)}
                  >
                    {settingsBusy ? (
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

            {step === LANDLORD_ONBOARDING_WIZARD_LAST_STEP_INDEX ? (
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
                  <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-zinc-400">
                    First property
                  </p>
                  <h2 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-zinc-900 dark:text-white md:text-5xl">
                    Add an address
                  </h2>
                  <p className="max-w-xl font-headline text-base font-light text-zinc-500">
                    We create the property and wire compliance and rent around it. You can edit everything next in your
                    portfolio.
                  </p>
                </div>

                <div className="space-y-5">
                  {isGoogleMapsConfigured() ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-headline text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                        Pick on map or type
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          id="onboarding-address-manual"
                          type="checkbox"
                          checked={addressManualOnly}
                          onChange={(e) => setAddressManualOnly(e.target.checked)}
                          className="size-3.5 rounded border-zinc-600 bg-zinc-50 dark:bg-zinc-950 accent-white"
                        />
                        <Label
                          htmlFor="onboarding-address-manual"
                          className="cursor-pointer font-headline text-xs font-normal text-zinc-500"
                        >
                          Add address manually
                        </Label>
                      </div>
                    </div>
                  ) : null}

                  {!addressManualOnly && isGoogleMapsConfigured() ? (
                    <AddressMapPicker
                      onResolved={(v) => {
                        setPropertyStreet(v.line1);
                        setPropertyCity(v.city);
                        setPropertyPostcode(v.postcode);
                      }}
                      mapClassName="border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50"
                      searchInputClassName={onboardingInputClass}
                    />
                  ) : null}

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="ob-street" className="font-headline text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500">
                        Street address
                      </Label>
                      {!addressManualOnly && isGoogleMapsConfigured() ? (
                        <>
                          <PlacesStreetAutocomplete
                            id="ob-street"
                            value={propertyStreet}
                            onChange={setPropertyStreet}
                            onPlaceSelected={(v) => {
                              setPropertyStreet(v.line1);
                              setPropertyCity(v.city);
                              setPropertyPostcode(v.postcode);
                            }}
                            onResolveFailed={() =>
                              toast.error("Could not read that address. Try another suggestion or enter details manually.")
                            }
                            placeholder="Start typing — pick a suggestion to fill street, city, and postcode"
                            className={cn(
                              "h-12 w-full rounded-md border border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 px-4 font-headline text-base font-light text-white placeholder:text-zinc-600 focus-visible:border-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none disabled:opacity-50",
                            )}
                          />
                          <p className="font-headline text-xs font-light text-zinc-600">
                            Suggestions from Google as you type. You can still edit any field after selecting.
                          </p>
                        </>
                      ) : (
                        <Input
                          id="ob-street"
                          value={propertyStreet}
                          onChange={(e) => setPropertyStreet(e.target.value)}
                          placeholder="e.g. 12 King Street"
                          className={onboardingInputClass}
                        />
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="ob-postcode" className="font-headline text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500">
                          Postcode
                        </Label>
                        <Input
                          id="ob-postcode"
                          value={propertyPostcode}
                          onChange={(e) => setPropertyPostcode(e.target.value)}
                          placeholder="e.g. M1 1AA"
                          className={onboardingInputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ob-city" className="font-headline text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500">
                          City
                        </Label>
                        <Input
                          id="ob-city"
                          value={propertyCity}
                          onChange={(e) => setPropertyCity(e.target.value)}
                          placeholder="e.g. Manchester"
                          className={onboardingInputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <button
                    type="button"
                    onClick={back}
                    className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Back
                  </button>
                  <Button
                    type="button"
                    disabled={propertyBusy || !canSubmitProperty}
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

        <div className="mt-auto shrink-0 border-t border-zinc-900/90 pt-8 pb-4 md:pt-10 md:pb-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <button
              type="button"
              onClick={() => void handleSkipOnboarding()}
              disabled={skipBusy || stepBusy}
              className="font-headline text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300 hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              {skipBusy ? "Opening dashboard…" : "Skip for now — finish from the dashboard"}
            </button>
            <p className="max-w-md font-headline text-[0.65rem] font-light leading-relaxed text-zinc-600">
              We&apos;ll show a short checklist on your home screen for anything you still want to finish after you land
              in Letora.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
