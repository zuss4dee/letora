"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import { startTransition, useCallback, useEffect, useLayoutEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "letora:postSetupChecklistDismissed";
const SESSION_SHOW_KEY = "letora:postSetupChecklistShow";

const ROWS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Confirm your chase email template", href: "/dashboard/settings?tab=email" },
  { label: "Review agent settings", href: "/dashboard/settings?tab=ai" },
  { label: "Check your first AI draft in Approvals", href: "/dashboard/agents/approvals" },
  { label: "Set up rent tracker for your first property", href: "/dashboard/rent-tracker" },
];

export function PostSetupChecklistPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postSetup = searchParams.get("postSetup") === "1";

  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const stripPostSetupFromUrl = () => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("postSetup");
      const qs = next.toString();
      router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
    };

    if (localStorage.getItem(DISMISS_KEY) === "1") {
      if (postSetup) stripPostSetupFromUrl();
      return;
    }

    if (postSetup) {
      try {
        sessionStorage.setItem(SESSION_SHOW_KEY, "1");
      } catch {
        /* quota */
      }
      stripPostSetupFromUrl();
      startTransition(() => setVisible(true));
      return;
    }
    try {
      if (sessionStorage.getItem(SESSION_SHOW_KEY) === "1") {
        startTransition(() => setVisible(true));
      }
    } catch {
      startTransition(() => setVisible(false));
    }
  }, [postSetup, router, searchParams]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
      sessionStorage.removeItem(SESSION_SHOW_KEY);
    } catch {
      /* quota */
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss, visible]);

  if (!visible) return null;

  return (
    <section
      className={cn(
        "mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900",
      )}
      aria-labelledby="post-setup-checklist-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Getting settled
          </p>
          <h2 id="post-setup-checklist-heading" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Finish wiring Letora to your portfolio
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Quick wins after onboarding or an import — tap a row when you&apos;re ready.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          onClick={dismiss}
          aria-label="Dismiss checklist"
        >
          <X className="size-4" />
        </Button>
      </div>
      <ul className="mt-4 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {ROWS.map((row) => (
          <li key={row.href}>
            <Link
              href={row.href}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
            >
              <span>{row.label}</span>
              <ChevronRight className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
