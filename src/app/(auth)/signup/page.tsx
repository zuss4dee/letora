"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

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

const signupSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);

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

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName,
        },
      },
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    setEmailConfirmationSent(true);
  }

  return (
    <AuthSplitShell aside={<AuthEditorialAside variant="signup" />}>
      <div className="w-full max-w-[380px] space-y-8">
        <AuthBrandMark />

        <div className="space-y-1 text-center">
          <h2 className="font-headline text-lg font-light tracking-tight text-foreground">Create your account</h2>
          <p className="font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
            Set up your workspace and start managing your portfolio.
          </p>
        </div>

        <Suspense fallback={null}>
          <SignupPlanHint />
        </Suspense>

        {emailConfirmationSent ? (
          <div className="space-y-4 rounded-xl border border-[rgb(72_72_72_/0.18)] bg-[#0e0e0e]/60 px-5 py-6 text-left backdrop-blur-sm">
            <p className="font-headline text-base font-light text-foreground">Check your email</p>
            <p className="font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-foreground">
              We sent you a confirmation link. Once confirmed, you can{" "}
              <Link href="/login" className="font-medium text-[#BD9952] underline-offset-4 hover:underline">
                sign in
              </Link>
              .
            </p>
          </div>
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
                placeholder="Jane Landlord"
                className={authInputClassName}
                {...form.register("fullName")}
              />
              {form.formState.errors.fullName ? (
                <p className="text-xs text-[#c97a76]">{form.formState.errors.fullName.message}</p>
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
                placeholder="you@company.com"
                className={authInputClassName}
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-xs text-[#c97a76]">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                data-testid="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className={authInputClassName}
                {...form.register("password")}
              />
              {form.formState.errors.password ? (
                <p className="text-xs text-[#c97a76]">{form.formState.errors.password.message}</p>
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
                placeholder="••••••••"
                className={authInputClassName}
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword ? (
                <p className="text-xs text-[#c97a76]">{form.formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>

            {submitError ? (
              <p className="rounded-md border border-[#BB5551]/35 bg-[#1a1210]/90 px-3 py-2.5 text-sm text-[#e8a8a4]" role="alert">
                {submitError}
              </p>
            ) : null}

            <Button type="submit" data-testid="signup-submit" className={authPrimaryButtonClassName} disabled={isSubmitting}>
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
        )}

        <p className="text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 transition-colors hover:text-[#BD9952] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthSplitShell>
  );
}
