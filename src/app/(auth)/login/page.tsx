"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginAuthAlert({ error }: { error: { message: string; code?: string } }) {
  const kind = classifySignInError(error);
  const boxClass =
    "rounded-md border border-[#BB5551]/35 bg-[#1a1210]/90 px-3 py-2.5 text-xs font-normal text-[#e8a8a4]";

  if (kind === "invalid_credentials") {
    return (
      <div className={`${boxClass} space-y-2`} role="alert">
        <p className="font-medium text-[#e8a8a4]">We couldn&apos;t sign you in with that email and password.</p>
        <p className="leading-relaxed text-[#e8a8a4]/90">
          There isn&apos;t an account with those details, or the password doesn&apos;t match. If you removed your Letora
          account, you can{" "}
          <Link href="/signup" className="font-medium text-[#BD9952] underline-offset-4 hover:underline">
            create a new account
          </Link>
          . Otherwise double-check your password.
        </p>
      </div>
    );
  }

  if (kind === "email_not_confirmed") {
    return (
      <p className={boxClass} role="alert">
        Confirm your email using the link we sent you, then try signing in again.
      </p>
    );
  }

  if (kind === "rate_limit") {
    return (
      <p className={boxClass} role="alert">
        Too many sign-in attempts. Wait a few minutes and try again.
      </p>
    );
  }

  return (
    <p className={boxClass} role="alert">
      {signInErrorMessageForOther(error.message)}
    </p>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get("next") ?? "/dashboard", [searchParams]);

  const [authError, setAuthError] = useState<{ message: string; code?: string } | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onSubmit",
  });

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

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <AuthSplitShell aside={<AuthEditorialAside variant="login" />}>
      <div className="w-full max-w-[380px] space-y-8">
        <AuthBrandMark />

        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="email" className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              data-testid="login-email"
              type="email"
              autoComplete="email"
              placeholder="hello@letora.ai"
              className={authInputClassName}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-[#c97a76]">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password" className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted-foreground">
                Password
              </Label>
              <Link
                href="#"
                className="text-[0.7rem] font-medium text-[#6b6a69] transition-colors hover:text-[#BD9952]"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              data-testid="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className={authInputClassName}
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-[#c97a76]">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          {authError ? <LoginAuthAlert error={authError} /> : null}

          <Button type="submit" data-testid="login-submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Continue"}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[rgb(72_72_72_/0.25)]" />
            <span className="font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[#6b6a69]">
              or
            </span>
            <div className="h-px flex-1 bg-[rgb(72_72_72_/0.25)]" />
          </div>
          <p className="text-center font-[family-name:var(--font-inter)] text-sm font-normal text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-foreground underline-offset-4 transition-colors hover:text-[#BD9952] hover:underline">
              Sign up
            </Link>
          </p>
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
