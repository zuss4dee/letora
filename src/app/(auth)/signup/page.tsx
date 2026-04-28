"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";

import { AuthBrandMark } from "@/components/auth/auth-brand-mark";
import { SignupPlanHint } from "@/components/auth/signup-plan-hint";
import { AuthEditorialAside } from "@/components/auth/auth-editorial-aside";
import {
  authInputClassName,
  authPrimaryButtonClassName,
  AuthSplitShell,
} from "@/components/auth/auth-split-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { resendAuthEmailErrorForUser, signUpErrorForUser } from "@/lib/user-facing-errors";
import { PLANS, type PlanKey } from "@/lib/stripe-plans";
import { getBrowserAuthCallbackUrl } from "@/lib/auth/email-auth-redirect";
import { requiredEmailSchema } from "@/lib/validations/email";

const signupSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required"),
    email: requiredEmailSchema,
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

function SignupEmailConfirmation({
  email,
  onUseDifferentEmail,
}: {
  email: string;
  onUseDifferentEmail: () => void;
}) {
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSentHint, setResendSentHint] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function handleResend() {
    if (cooldown > 0 || isResending) return;
    setResendError(null);
    setResendSentHint(false);
    setIsResending(true);
    const supabase = createClient();
    const redirectTo = getBrowserAuthCallbackUrl();
    if (!redirectTo) {
      setIsResending(false);
      setResendError("Could not build a confirmation link. Refresh the page and try again.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: { emailRedirectTo: redirectTo },
    });
    setIsResending(false);
    if (error) {
      setResendError(resendAuthEmailErrorForUser(error));
      return;
    }
    setResendSentHint(true);
    setCooldown(60);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-3 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/70 dark:bg-muted/25"
          aria-hidden
        >
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="font-headline text-xl font-light tracking-tight text-foreground">Check your inbox</h2>
          <p className="mx-auto max-w-[300px] font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
            Open the link we sent to confirm your address.
          </p>
        </div>
        <p className="break-all font-[family-name:var(--font-inter)] text-sm font-medium text-foreground">{email}</p>
      </div>

      <p className="text-center font-[family-name:var(--font-inter)] text-xs leading-relaxed text-muted-foreground">
        Nothing after a couple of minutes? Check spam or promotions. You can resend below or fix a typo in your email.
      </p>

      {resendError ? (
        <p className="text-center text-sm text-destructive dark:text-[#e8a8a4]" role="alert">
          {resendError}
        </p>
      ) : null}
      {resendSentHint ? (
        <p className="text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
          If an account is waiting on this address, we sent another message.
        </p>
      ) : null}

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-md font-[family-name:var(--font-inter)] text-[13px]"
          onClick={handleResend}
          disabled={isResending || cooldown > 0}
        >
          {isResending ? "Sending…" : cooldown > 0 ? `Resend email (${cooldown}s)` : "Resend confirmation email"}
        </Button>
        <button
          type="button"
          className="w-full font-[family-name:var(--font-inter)] text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          onClick={onUseDifferentEmail}
        >
          Wrong email? Go back and change it
        </button>
      </div>

      <p className="text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
        Already confirmed?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 transition-colors hover:text-zinc-400 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

function resolvePlanKeyFromSearch(planParam: string | null): PlanKey {
  if (planParam === "starter" || planParam === "pro" || planParam === "landlord_pro") {
    return planParam;
  }
  return "starter";
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(null);
  const [sessionCheckDone, setSessionCheckDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setSessionUserEmail(data.user?.email?.trim() ? data.user.email : null);
      setSessionCheckDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: SignupValues) {
    setSubmitError(null);
    const supabase = createClient();

    const planKey = resolvePlanKeyFromSearch(searchParams.get("plan"));
    const intent = searchParams.get("intent");
    /** Enterprise flows talk to sales first — skip forced checkout metadata. */
    const pendingCheckoutPlan = intent === "enterprise" ? undefined : planKey;

    const redirectTo = getBrowserAuthCallbackUrl();
    if (!redirectTo) {
      setSubmitError("Could not build a confirmation link. Refresh the page and try again.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: values.fullName,
          ...(pendingCheckoutPlan ? { pending_checkout_plan: pendingCheckoutPlan } : {}),
        },
      },
    });

    if (error) {
      setSubmitError(signUpErrorForUser(error));
      return;
    }

    /** Supabase may return a user row with no identities when the email is already registered (no error set). */
    const identities = data.user?.identities;
    if (data.user && Array.isArray(identities) && identities.length === 0) {
      setSubmitError("An account with this email already exists. Please sign in instead.");
      return;
    }

    if (data.session) {
      const priceId = PLANS[planKey].priceId?.trim();
      if (!priceId) {
        setSubmitError("Checkout isn’t available right now. Please try again later or contact support.");
        return;
      }
      window.location.href = `/api/stripe/checkout?priceId=${encodeURIComponent(priceId)}&plan=${encodeURIComponent(planKey)}`;
      return;
    }

    setPendingEmail(values.email);
    setEmailConfirmationSent(true);
  }

  function handleUseDifferentEmail() {
    setEmailConfirmationSent(false);
    setPendingEmail(null);
  }

  if (!sessionCheckDone) {
    return (
      <div className="space-y-4" aria-busy>
        <div className="h-6 animate-pulse rounded bg-muted/30" />
        <div className="h-10 animate-pulse rounded bg-muted/20" />
        <div className="h-10 animate-pulse rounded bg-muted/20" />
      </div>
    );
  }

  if (sessionUserEmail) {
    return (
      <div className="space-y-5 text-center">
        <div className="space-y-1">
          <h2 className="font-headline text-lg font-light tracking-tight text-foreground">You’re already signed in</h2>
          <p className="font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-muted-foreground">
            This browser has an active Letora session{sessionUserEmail ? ` (${sessionUserEmail})` : ""}. Open your
            workspace, or sign out if you need to use a different account.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" className={authPrimaryButtonClassName} onClick={() => router.push("/dashboard")}>
            Go to dashboard
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-md font-[family-name:var(--font-inter)] text-[13px]"
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              setSessionUserEmail(null);
              router.refresh();
            }}
          >
            Sign out
          </Button>
        </div>
        <p className="font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
          Wrong place?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:text-zinc-400 hover:underline">
            Sign in with another email
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      {emailConfirmationSent && pendingEmail ? null : (
        <div className="space-y-1 text-center">
          <h2 className="font-headline text-lg font-light tracking-tight text-foreground">Create your account</h2>
          <p className="font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
            Set up your workspace and start managing your portfolio.
          </p>
        </div>
      )}

      {emailConfirmationSent ? null : (
        <Suspense fallback={null}>
          <SignupPlanHint />
        </Suspense>
      )}

      {emailConfirmationSent && pendingEmail ? (
        <SignupEmailConfirmation email={pendingEmail} onUseDifferentEmail={handleUseDifferentEmail} />
      ) : (
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="fullName" className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted-foreground">
              Full name
            </Label>
            <Input
              id="fullName"
              data-testid="signup-fullname"
              autoComplete="name"
              className={authInputClassName}
              {...form.register("fullName")}
            />
            {form.formState.errors.fullName ? (
              <p className="text-xs text-destructive dark:text-[#c97a76]">{form.formState.errors.fullName.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              data-testid="signup-email"
              type="email"
              autoComplete="email"
              className={authInputClassName}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive dark:text-[#c97a76]">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="password" className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted-foreground">
                Password
              </Label>
              <p id="signup-password-hint" className="font-[family-name:var(--font-inter)] text-[11px] leading-snug text-muted-foreground/80">
                At least 8 characters.
              </p>
            </div>
            <Input
              id="password"
              data-testid="signup-password"
              type="password"
              autoComplete="new-password"
              className={authInputClassName}
              aria-describedby="signup-password-hint"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive dark:text-[#c97a76]">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted-foreground">
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              data-testid="signup-confirm-password"
              type="password"
              autoComplete="new-password"
              className={authInputClassName}
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-xs text-destructive dark:text-[#c97a76]">{form.formState.errors.confirmPassword.message}</p>
            ) : null}
          </div>

          {submitError ? (
            <p
              className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive dark:border-[#BB5551]/35 dark:bg-[#1a1210]/90 dark:text-[#e8a8a4]"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <Button type="submit" data-testid="signup-submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      )}

      {emailConfirmationSent ? null : (
        <p className="text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 transition-colors hover:text-zinc-400 hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </>
  );
}

export default function SignupPage() {
  return (
    <AuthSplitShell aside={<AuthEditorialAside variant="signup" />}>
      <div className="w-full max-w-[380px]">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 shrink-0 stroke-[1.25]" aria-hidden />
          Back to website
        </Link>
        <div className="space-y-8">
        <AuthBrandMark />

        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-6 animate-pulse rounded bg-muted/30" />
              <div className="h-10 animate-pulse rounded bg-muted/20" />
              <div className="h-10 animate-pulse rounded bg-muted/20" />
            </div>
          }
        >
          <SignupForm />
        </Suspense>
        </div>
      </div>
    </AuthSplitShell>
  );
}
