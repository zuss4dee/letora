"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, FileSpreadsheet, Loader2, Upload, UserPlus } from "lucide-react";
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
  completeOnboardingWithFirstTenant,
  completeOnboardingWithProperty,
  importTenantsFromFileOnboarding,
  saveOnboardingFocus,
  saveOnboardingIdentity,
  saveOnboardingSettingsEssentials,
  skipOnboarding,
} from "@/lib/actions/user-onboarding";
import {
  FOCUS_OPTIONS,
  MAX_ONBOARDING_PRIORITIES,
  parseStoredPrimaryGoals,
  type FocusOptionId,
} from "@/lib/onboarding/priorities";
import { isValidEmailOrEmpty } from "@/lib/validations/email";
import { cn } from "@/lib/utils";

const nextGlow =
  "bg-[#BD9952] text-[#141008] shadow-[0_0_22px_-2px_rgba(189,153,82,0.55),0_0_44px_-8px_rgba(189,153,82,0.28)] transition-[box-shadow,transform] hover:shadow-[0_0_32px_-2px_rgba(189,153,82,0.65),0_0_56px_-6px_rgba(189,153,82,0.35)] hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-50 disabled:shadow-none";

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

export type OnboardingWizardStep = 0 | 1 | 2 | 3 | 4;

/** Step 4: pick how to add tenants, then either manual form or import instructions + upload. */
type TenantOnboardPhase = "choose" | "manual" | "import";

const ONBOARDING_STEPS = [
  "Identity",
  "Priorities",
  "Landlord & agency",
  "First property",
  "Tenants",
] as const;

const TOTAL_ONBOARDING_STEPS = 5;

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

  const [tenantFullName, setTenantFullName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEntryMode, setTenantEntryMode] = useState<"single" | "import">("single");
  const [tenantPhase, setTenantPhase] = useState<TenantOnboardPhase>("choose");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [tenantBusy, setTenantBusy] = useState(false);
  const [skipBusy, setSkipBusy] = useState(false);

  const finishCheckoutSuccess = useCallback(async () => {
    const res = await completeOnboardingGate();
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Payment received. Continue below to finish setup.");
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
      if (identityBusy || focusBusy || settingsBusy || propertyBusy || tenantBusy) return;

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
          step === 3 &&
          propertyStreet.trim().length >= 1 &&
          propertyCity.trim().length >= 1 &&
          propertyPostcode.trim().length >= 1
        ) {
          e.preventDefault();
          void submitProperty();
        }
        if (
          step === 4 &&
          tenantPhase === "manual" &&
          tenantEntryMode === "single" &&
          tenantFullName.trim().length >= 2 &&
          tenantEmail.includes("@") &&
          tenantPhone.trim().length >= 7
        ) {
          e.preventDefault();
          void submitTenant();
        }
        if (step === 4 && tenantPhase === "import" && tenantEntryMode === "import" && importFile) {
          e.preventDefault();
          void submitTenantImport();
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
        step === 3 &&
        propertyStreet.trim().length >= 1 &&
        propertyCity.trim().length >= 1 &&
        propertyPostcode.trim().length >= 1
      ) {
        e.preventDefault();
        void submitProperty();
      } else if (
        step === 4 &&
        tenantPhase === "manual" &&
        tenantEntryMode === "single" &&
        tenantFullName.trim().length >= 2 &&
        tenantEmail.includes("@") &&
        tenantPhone.trim().length >= 7
      ) {
        e.preventDefault();
        void submitTenant();
      } else if (step === 4 && tenantPhase === "import" && tenantEntryMode === "import" && importFile) {
        e.preventDefault();
        void submitTenantImport();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // submit* are stable enough per render; step + fields drive behavior
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
    tenantBusy,
    landlordName,
    contactEmail,
    referencingAgencyEmail,
    noAgencyOrReferencing,
    tenantFullName,
    tenantEmail,
    tenantPhone,
    tenantEntryMode,
    tenantPhase,
    importFile,
  ]);

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

  async function submitSettings() {
    setSettingsBusy(true);
    try {
      const res = await saveOnboardingSettingsEssentials({
        portfolioName,
        landlordName,
        contactEmail: noAgencyOrReferencing ? "" : contactEmail,
        referencingAgencyEmail: noAgencyOrReferencing ? "" : referencingAgencyEmail,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDir(1);
      setStep(3);
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
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDir(1);
      setTenantPhase("choose");
      setImportFile(null);
      setStep(4);
    } finally {
      setPropertyBusy(false);
    }
  }

  async function submitTenant() {
    setTenantBusy(true);
    try {
      const res = await completeOnboardingWithFirstTenant({
        fullName: tenantFullName.trim(),
        email: tenantEmail.trim(),
        phone: tenantPhone.trim(),
        rightToRentStatus: "pending",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setTenantBusy(false);
    }
  }

  const stepBusy = identityBusy || focusBusy || settingsBusy || propertyBusy || tenantBusy;

  async function handleSkipOnboarding() {
    if (skipBusy || stepBusy) return;
    setSkipBusy(true);
    try {
      const res = await skipOnboarding();
      if (!res.ok) {
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

  async function submitTenantImport() {
    if (!importFile) {
      toast.error("Choose a spreadsheet or document to import.");
      return;
    }
    setTenantBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await importTenantsFromFileOnboarding(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const parts: string[] = [`Added ${res.added} tenant profile${res.added === 1 ? "" : "s"}.`];
      if (res.needsDetailsLater > 0) {
        parts.push(
          `${res.needsDetailsLater} ${res.needsDetailsLater === 1 ? "needs" : "need"} email or phone — open Tenants to finish.`,
        );
      }
      if (res.skipped > 0) {
        parts.push(`${res.skipped} row${res.skipped === 1 ? "" : "s"} skipped (duplicates or invalid).`);
      }
      toast.success(parts.join(" "));
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setTenantBusy(false);
    }
  }

  function back() {
    if (step === 0) return;
    setDir(-1);
    setStep((s) => (s - 1) as OnboardingWizardStep);
  }

  function tenantStepBack() {
    if (step !== 4) return;
    if (tenantPhase !== "choose") {
      setDir(-1);
      setTenantPhase("choose");
      return;
    }
    back();
  }

  const progress = ((step + 1) / TOTAL_ONBOARDING_STEPS) * 100;
  const progressValue = Math.round(progress);
  const stepsRemainingAfter = TOTAL_ONBOARDING_STEPS - (step + 1);

  const onboardingInputClass =
    "h-12 border-zinc-800 bg-zinc-950/40 px-4 font-headline text-base font-light text-white placeholder:text-zinc-600 focus-visible:border-[#BD9952]/45 focus-visible:ring-2 focus-visible:ring-[#BD9952]/15";

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

  const canSubmitTenant =
    tenantEntryMode === "single" &&
    tenantFullName.trim().length >= 2 &&
    tenantEmail.includes("@") &&
    tenantPhone.trim().length >= 7;

  const canSubmitTenantImport = tenantEntryMode === "import" && importFile !== null;

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
            aria-valuetext={`Step ${step + 1} of ${TOTAL_ONBOARDING_STEPS}`}
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
        <header className="mb-10 flex flex-col gap-3 md:mb-14">
          <div className="flex items-center gap-4">
            <span className="font-headline text-[0.6rem] font-medium uppercase tracking-[0.38em] text-zinc-600">
              Letora
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/90 to-transparent" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#BD9952]/90">
              Step {step + 1} of {TOTAL_ONBOARDING_STEPS} · {ONBOARDING_STEPS[step]}
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
                    Priorities
                  </p>
                  <h2 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-white md:text-5xl">
                    What should we prioritise?
                  </h2>
                  <p className="max-w-xl font-headline text-base font-light text-zinc-500">
                    Choose at least one and up to {MAX_ONBOARDING_PRIORITIES} areas — we tune defaults and assistant
                    behaviour around your selections. Tap again to remove.
                  </p>
                  <p className="font-headline text-sm font-medium text-[#BD9952]/90" aria-live="polite">
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
                            ? "border-[#BD9952]/50 bg-[#BD9952]/[0.06]"
                            : "border-zinc-800/90 bg-transparent hover:border-zinc-700",
                        )}
                      >
                        <span className="flex items-start justify-between gap-4">
                          <span className="font-headline text-xl font-light tracking-tight text-white md:text-[1.35rem]">
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
                    className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-300"
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
                  <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#BD9952]/90">
                    Essentials
                  </p>
                  <h2 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-white md:text-5xl">
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
                      <span className="normal-case tracking-normal text-[#BD9952]/90">(required)</span>
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

                  <div className="flex gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-4 py-3">
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
                      className="mt-0.5 border-zinc-600 data-checked:border-[#BD9952] data-checked:bg-[#BD9952] data-checked:text-[#141008]"
                    />
                    <label htmlFor="ob-no-agency" className="cursor-pointer font-headline text-sm font-light leading-snug text-zinc-300">
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
                    className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-300"
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

            {step === 3 ? (
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
                          className="size-3.5 rounded border-zinc-600 bg-zinc-950 accent-[#BD9952]"
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
                      mapClassName="border-zinc-800 bg-zinc-900/50"
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
                              "h-12 w-full rounded-md border border-zinc-800 bg-zinc-950/40 px-4 font-headline text-base font-light text-white placeholder:text-zinc-600 focus-visible:border-[#BD9952]/45 focus-visible:ring-2 focus-visible:ring-[#BD9952]/15 focus-visible:outline-none disabled:opacity-50",
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
                    className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-300"
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
                        Next
                        <ArrowRight className="ml-2 size-4 opacity-90" aria-hidden />
                      </>
                    )}
                  </Button>
                </div>
              </motion.section>
            ) : null}

            {step === 4 ? (
              <motion.section
                key={`tenant-${tenantPhase}`}
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
                className="space-y-12"
              >
                {tenantPhase === "choose" ? (
                  <>
                    <div className="space-y-5">
                      <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#BD9952]/90">
                        First tenant
                      </p>
                      <h2 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-white md:text-5xl">
                        How do you want to add your tenant?
                      </h2>
                      <p className="max-w-xl font-headline text-base font-light leading-relaxed text-zinc-500">
                        You don&apos;t need every detail from memory. Enter one person when you have it to hand, or bring
                        a list from a spreadsheet or document and we&apos;ll create profiles for you — you can tidy
                        anything missing later in <span className="text-zinc-400">Tenants</span>.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTenantEntryMode("single");
                          setTenantPhase("manual");
                        }}
                        className="flex flex-col items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/30 px-5 py-6 text-left transition-colors hover:border-zinc-700"
                      >
                        <UserPlus className="size-6 text-[#BD9952]" aria-hidden />
                        <span className="font-headline text-lg font-light tracking-tight text-white">Enter manually</span>
                        <span className="font-headline text-sm font-light leading-relaxed text-zinc-500">
                          Type full name, email, and phone when you&apos;re ready. You can edit this anytime.
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTenantEntryMode("import");
                          setTenantPhase("import");
                          setImportFile(null);
                        }}
                        className="flex flex-col items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/30 px-5 py-6 text-left transition-colors hover:border-zinc-700"
                      >
                        <FileSpreadsheet className="size-6 text-[#BD9952]" aria-hidden />
                        <span className="font-headline text-lg font-light tracking-tight text-white">
                          Import from a file
                        </span>
                        <span className="font-headline text-sm font-light leading-relaxed text-zinc-500">
                          Upload CSV, TXT, PDF, or Word — we parse rows locally or use AI for documents.
                        </span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                      <button
                        type="button"
                        onClick={tenantStepBack}
                        className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-300"
                      >
                        Back
                      </button>
                    </div>
                  </>
                ) : null}

                {tenantPhase === "manual" ? (
                  <>
                    <div className="space-y-5">
                      <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#BD9952]/90">
                        First tenant
                      </p>
                      <h2 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-white md:text-5xl">
                        Tenant details
                      </h2>
                      <p className="max-w-xl font-headline text-base font-light leading-relaxed text-zinc-500">
                        Add the main tenant for this property. Everything here can be updated later from{" "}
                        <span className="text-zinc-400">Tenants</span>.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="ob-t-name"
                          className="font-headline text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500"
                        >
                          Full name
                        </Label>
                        <Input
                          id="ob-t-name"
                          value={tenantFullName}
                          onChange={(e) => setTenantFullName(e.target.value)}
                          autoComplete="name"
                          placeholder="e.g. Alex Johnson"
                          className={onboardingInputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="ob-t-email"
                          className="font-headline text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500"
                        >
                          Email
                        </Label>
                        <Input
                          id="ob-t-email"
                          type="email"
                          value={tenantEmail}
                          onChange={(e) => setTenantEmail(e.target.value)}
                          autoComplete="email"
                          placeholder="tenant@email.com"
                          className={onboardingInputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="ob-t-phone"
                          className="font-headline text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500"
                        >
                          Phone
                        </Label>
                        <Input
                          id="ob-t-phone"
                          type="tel"
                          value={tenantPhone}
                          onChange={(e) => setTenantPhone(e.target.value)}
                          autoComplete="tel"
                          placeholder="e.g. 07700 900000"
                          className={onboardingInputClass}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                      <button
                        type="button"
                        onClick={tenantStepBack}
                        className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-300"
                      >
                        Back
                      </button>
                      <Button
                        type="button"
                        disabled={tenantBusy || !canSubmitTenant}
                        onClick={() => void submitTenant()}
                        className={cn(
                          "h-14 rounded-full px-10 font-headline text-xs font-semibold uppercase tracking-[0.22em]",
                          nextGlow,
                        )}
                      >
                        {tenantBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <>
                            Enter Letora
                            <ArrowRight className="ml-2 size-4 opacity-90" aria-hidden />
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : null}

                {tenantPhase === "import" ? (
                  <>
                    <div className="space-y-5">
                      <p className="font-headline text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#BD9952]/90">
                        First tenant
                      </p>
                      <h2 className="font-headline text-4xl font-extralight leading-[1.08] tracking-[-0.045em] text-white md:text-5xl">
                        Import your tenant list
                      </h2>
                      <p className="max-w-xl font-headline text-base font-light leading-relaxed text-zinc-500">
                        Follow the steps below, then upload your file. We&apos;ll create tenant profiles; you can add or
                        fix details in <span className="text-zinc-400">Tenants</span> afterwards.
                      </p>
                    </div>

                    <ol className="list-none space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/30 p-6">
                      <li className="flex gap-4">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#BD9952]/40 bg-[#BD9952]/10 font-headline text-xs font-semibold text-[#BD9952]"
                          aria-hidden
                        >
                          1
                        </span>
                        <div className="space-y-1">
                          <p className="font-headline text-sm font-medium text-zinc-200">Prepare your file</p>
                          <p className="font-headline text-sm font-light leading-relaxed text-zinc-500">
                            <strong className="font-medium text-zinc-400">CSV or TXT:</strong> include columns for name,
                            email, and phone (a header row is optional). Rows are parsed on the server — no AI needed.
                          </p>
                          <p className="font-headline text-sm font-light leading-relaxed text-zinc-500">
                            <strong className="font-medium text-zinc-400">PDF or Word:</strong> we extract tenant rows
                            with AI. Your project needs <code className="text-zinc-600">ANTHROPIC_API_KEY</code> on the
                            server.
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-4">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#BD9952]/40 bg-[#BD9952]/10 font-headline text-xs font-semibold text-[#BD9952]"
                          aria-hidden
                        >
                          2
                        </span>
                        <div className="space-y-1">
                          <p className="font-headline text-sm font-medium text-zinc-200">Check size and scope</p>
                          <p className="font-headline text-sm font-light leading-relaxed text-zinc-500">
                            Keep the file under <strong className="font-medium text-zinc-400">5 MB</strong>. Lists are
                            meant for roughly <strong className="font-medium text-zinc-400">up to 50 tenants</strong> per
                            import — focus on people tied to the property you just added.
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-4">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#BD9952]/40 bg-[#BD9952]/10 font-headline text-xs font-semibold text-[#BD9952]"
                          aria-hidden
                        >
                          3
                        </span>
                        <div className="space-y-1">
                          <p className="font-headline text-sm font-medium text-zinc-200">Upload and finish</p>
                          <p className="font-headline text-sm font-light leading-relaxed text-zinc-500">
                            Choose your file below, then run the import. Duplicates and invalid rows are skipped;
                            we&apos;ll tell you how many profiles were added.
                          </p>
                        </div>
                      </li>
                    </ol>

                    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/30 p-5">
                      <div className="flex items-start gap-3">
                        <Upload className="mt-0.5 size-5 shrink-0 text-[#BD9952]" aria-hidden />
                        <p className="font-headline text-sm font-light text-zinc-500">
                          Accepted: <span className="text-zinc-400">.csv</span>, <span className="text-zinc-400">.txt</span>,{" "}
                          <span className="text-zinc-400">.pdf</span>, <span className="text-zinc-400">.docx</span>
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="ob-tenant-import"
                          className="font-headline text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500"
                        >
                          File
                        </Label>
                        <Input
                          id="ob-tenant-import"
                          type="file"
                          accept=".csv,.txt,.pdf,.docx,application/pdf,text/csv,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className={cn(
                            "h-12 cursor-pointer border-zinc-800 bg-zinc-950/40 px-3 font-headline text-sm font-light text-white file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:font-headline file:text-xs file:text-zinc-200",
                          )}
                          onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                      <button
                        type="button"
                        onClick={tenantStepBack}
                        className="font-headline text-xs uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-300"
                      >
                        Back
                      </button>
                      <Button
                        type="button"
                        disabled={tenantBusy || !canSubmitTenantImport}
                        onClick={() => void submitTenantImport()}
                        className={cn(
                          "h-14 rounded-full px-10 font-headline text-xs font-semibold uppercase tracking-[0.22em]",
                          nextGlow,
                        )}
                      >
                        {tenantBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <>
                            Import &amp; enter Letora
                            <ArrowRight className="ml-2 size-4 opacity-90" aria-hidden />
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : null}
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
              className="font-headline text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              {skipBusy ? "Opening dashboard…" : "Skip for now — finish from the dashboard"}
            </button>
            <p className="max-w-md font-headline text-[0.65rem] font-light leading-relaxed text-zinc-600">
              We&apos;ll show a short checklist on your home screen until your profile, first property, and first tenant
              are in place.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
