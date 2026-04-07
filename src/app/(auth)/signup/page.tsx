"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
    <main className="w-full max-w-md">
      <Card className="rounded-lg border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <CardHeader className="space-y-5 pb-4">
          <div className="space-y-1">
            <div className="text-2xl font-bold tracking-tight">Letora</div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Property Operating System</p>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Create your account</div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Set up your workspace and start managing your portfolio.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {emailConfirmationSent ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-900 dark:text-zinc-100">Check your email</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                We sent you a confirmation link. Once confirmed, you can{" "}
                <Link href="/login" className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                  sign in
                </Link>
                .
              </p>
            </div>
          ) : (
            <form className="space-y-3.5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-zinc-700 dark:text-zinc-200">
                  Full name
                </Label>
                <Input
                  id="fullName"
                  data-testid="signup-fullname"
                  autoComplete="name"
                  placeholder="Jane Landlord"
                  className="h-10 rounded-md border-zinc-200 bg-white shadow-none focus-visible:ring-indigo-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:focus-visible:ring-indigo-400"
                  {...form.register("fullName")}
                />
                {form.formState.errors.fullName ? (
                  <p className="text-sm text-red-400">{form.formState.errors.fullName.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-700 dark:text-zinc-200">
                  Email
                </Label>
                <Input
                  id="email"
                  data-testid="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="h-10 rounded-md border-zinc-200 bg-white shadow-none focus-visible:ring-indigo-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:focus-visible:ring-indigo-400"
                  {...form.register("email")}
                />
                {form.formState.errors.email ? (
                  <p className="text-sm text-red-400">{form.formState.errors.email.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-700 dark:text-zinc-200">
                  Password
                </Label>
                <Input
                  id="password"
                  data-testid="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="h-10 rounded-md border-zinc-200 bg-white shadow-none focus-visible:ring-indigo-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:focus-visible:ring-indigo-400"
                  {...form.register("password")}
                />
                {form.formState.errors.password ? (
                  <p className="text-sm text-red-400">{form.formState.errors.password.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-zinc-700 dark:text-zinc-200">
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  data-testid="signup-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="h-10 rounded-md border-zinc-200 bg-white shadow-none focus-visible:ring-indigo-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:focus-visible:ring-indigo-400"
                  {...form.register("confirmPassword")}
                />
                {form.formState.errors.confirmPassword ? (
                  <p className="text-sm text-red-400">{form.formState.errors.confirmPassword.message}</p>
                ) : null}
              </div>

              {submitError ? (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  {submitError}
                </p>
              ) : null}

              <Button
                type="submit"
                data-testid="signup-submit"
                className="h-10 w-full rounded-md bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}

