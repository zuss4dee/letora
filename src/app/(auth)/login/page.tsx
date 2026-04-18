"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { AuthBrandMark } from "@/components/auth/auth-brand-mark";
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
import { classifySignInError, signInErrorMessageForOther } from "@/lib/user-facing-errors";
import { isValidEmailAddress, requiredEmailSchema } from "@/lib/validations/email";

const loginSchema = z.object({
  email: requiredEmailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

const authAlertBoxClass =
  "rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs font-normal text-destructive dark:border-[#BB5551]/35 dark:bg-[#1a1210]/90 dark:text-[#e8a8a4]";

function safePrefillEmail(raw: string | null): string {
  if (!raw?.trim()) return "";
  return isValidEmailAddress(raw) ? raw.trim() : "";
}

function LoginCallbackParamAlert({
  reason,
  message,
}: {
  reason: string | null;
  message: string | null;
}) {
  const detail = message?.trim() || reason?.trim();
  if (!detail) {
    return (
      <p className={authAlertBoxClass} role="alert">
        We couldn&apos;t finish signing you in from your email link. Enter your password below, or try requesting a new
        confirmation email from the sign-up page.
      </p>
    );
  }
  return (
    <p className={authAlertBoxClass} role="alert">
      {detail.length > 220 ? `${detail.slice(0, 217)}…` : detail}
    </p>
  );
}

function LoginAuthAlert({ error }: { error: { message: string; code?: string } }) {
  const kind = classifySignInError(error);

  if (kind === "invalid_credentials") {
    return (
      <div className={`${authAlertBoxClass} space-y-2`} role="alert">
        <p className="font-medium text-destructive dark:text-[#e8a8a4]">
          We couldn&apos;t sign you in with that email and password.
        </p>
        <p className="leading-relaxed text-destructive/90 dark:text-[#e8a8a4]/90">
          There isn&apos;t an account with those details, or the password doesn&apos;t match. If you removed your Letora
          account, you can{" "}
          <Link
            href="/signup"
            className="font-medium text-[#a67c2c] underline-offset-4 hover:underline dark:text-[#BD9952]"
          >
            create a new account
          </Link>
          . Otherwise double-check your password.
        </p>
      </div>
    );
  }

  if (kind === "email_not_confirmed") {
    return (
      <p className={authAlertBoxClass} role="alert">
        Confirm your email using the link we sent you, then try signing in again.
      </p>
    );
  }

  if (kind === "rate_limit") {
    return (
      <p className={authAlertBoxClass} role="alert">
        Too many sign-in attempts. Wait a few minutes and try again.
      </p>
    );
  }

  return (
    <p className={authAlertBoxClass} role="alert">
      {signInErrorMessageForOther(error.message)}
    </p>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get("next") ?? "/dashboard", [searchParams]);

  const prefillEmail = useMemo(() => {
    const fromQuery =
      searchParams.get("email") ?? searchParams.get("prefill_email") ?? searchParams.get("login_hint");
    return safePrefillEmail(fromQuery);
  }, [searchParams]);

  const callbackAuthError = useMemo(() => searchParams.get("auth_error"), [searchParams]);
  const callbackReason = useMemo(() => searchParams.get("reason"), [searchParams]);
  const callbackMessage = useMemo(() => searchParams.get("message"), [searchParams]);

  const [authError, setAuthError] = useState<{ message: string; code?: string } | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: prefillEmail,
      password: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset({
      email: prefillEmail,
      password: "",
    });
  }, [prefillEmail, form]);

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginValues) {
    setAuthError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setAuthError({ message: error.message, code: error.code });
      return;
    }

    const continueUrl = `/auth/continue?next=${encodeURIComponent(nextPath)}`;
    router.replace(continueUrl);
    router.refresh();
  }

  return (
    <AuthSplitShell aside={<AuthEditorialAside variant="login" />}>
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

        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          {callbackAuthError === "callback" ? (
            <LoginCallbackParamAlert reason={callbackReason} message={callbackMessage} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email" className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              data-testid="login-email"
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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password" className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted-foreground">
                Password
              </Label>
              <Link
                href="#"
                className="text-[0.7rem] font-medium text-muted-foreground transition-colors hover:text-[#a67c2c] dark:hover:text-[#BD9952]"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              data-testid="login-password"
              type="password"
              autoComplete="current-password"
              className={authInputClassName}
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive dark:text-[#c97a76]">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          {authError ? <LoginAuthAlert error={authError} /> : null}

          <Button type="submit" data-testid="login-submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Continue"}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="text-center font-[family-name:var(--font-inter)] text-sm font-normal text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-foreground underline-offset-4 transition-colors hover:text-[#BD9952] hover:underline">
              Sign up
            </Link>
          </p>
        </div>
        </div>
      </div>
    </AuthSplitShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[560px] w-full max-w-[1080px] items-center justify-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
