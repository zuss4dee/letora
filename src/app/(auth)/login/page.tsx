"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get("next") ?? "/dashboard", [searchParams]);

  const [submitError, setSubmitError] = useState<string | null>(null);

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
    setSubmitError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <main className="w-full max-w-[1080px] font-normal">
      <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-[0_25px_80px_-40px_rgba(15,23,42,0.22)] transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_25px_80px_-40px_rgba(0,0,0,0.8)] lg:grid-cols-2">
        <section className="flex items-center justify-center bg-white px-6 py-14 transition-colors dark:bg-zinc-900">
          <div className="w-full max-w-[340px] space-y-6 rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
            <header className="space-y-3 text-center">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Letora</h1>
                <p className="text-sm font-normal text-zinc-500 dark:text-zinc-400">Property Operating System</p>
              </div>
            </header>

            <form className="space-y-3.5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="hello@letora.ai"
                  className="h-10 rounded-full border-zinc-300 bg-white/90 px-4 text-zinc-900 shadow-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus-visible:ring-indigo-400"
                  {...form.register("email")}
                />
                {form.formState.errors.email ? (
                  <p className="text-xs text-red-500 dark:text-red-400">{form.formState.errors.email.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Password
                  </Label>
                  <Link
                    href="#"
                    className="text-xs font-normal text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-10 rounded-full border-zinc-300 bg-white/90 px-4 text-zinc-900 shadow-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus-visible:ring-indigo-400"
                  {...form.register("password")}
                />
                {form.formState.errors.password ? (
                  <p className="text-xs text-red-500 dark:text-red-400">{form.formState.errors.password.message}</p>
                ) : null}
              </div>

              {submitError ? (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs font-normal text-red-600 dark:text-red-400">
                  {submitError}
                </p>
              ) : null}

              <Button
                type="submit"
                className="h-10 w-full rounded-full bg-indigo-600 text-[13px] font-normal text-white shadow-sm transition-colors hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Continue"}
              </Button>
            </form>

            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">or</span>
                <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
              </div>
              <p className="text-center text-xs font-normal text-zinc-500 dark:text-zinc-400">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-normal text-zinc-900 hover:underline dark:text-zinc-100">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </section>

        <aside className="relative hidden overflow-hidden border-l border-zinc-200 bg-zinc-50 transition-colors dark:border-zinc-800 dark:bg-zinc-950 lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,theme(colors.zinc.200/.55)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.zinc.200/.55)_1px,transparent_1px)] bg-[size:26px_26px] dark:hidden" />
          <div className="absolute inset-0 hidden dark:block dark:bg-[radial-gradient(circle_at_18%_25%,rgba(129,140,248,0.12),transparent_36%),radial-gradient(circle_at_75%_35%,rgba(129,140,248,0.09),transparent_42%),linear-gradient(170deg,#09090b_0%,#09090b_100%)]" />
          <div className="absolute inset-0 hidden dark:block dark:bg-[linear-gradient(to_right,theme(colors.zinc.900/.35)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.zinc.900/.35)_1px,transparent_1px)] dark:bg-[size:26px_26px]" />
        </aside>
      </div>
    </main>
  );
}

