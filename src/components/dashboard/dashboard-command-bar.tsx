"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import { Calendar, Layers, Presentation } from "lucide-react";

export function DashboardCommandBar({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const t = value.trim();
      if (t) {
        router.push(`/dashboard?q=${encodeURIComponent(t)}`);
      } else {
        router.push("/dashboard");
      }
      setValue("");
    },
    [router, value],
  );

  return (
    <section className={cn("relative", className)}>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-[6px] border border-border bg-card p-4 shadow-sm dark:border-white/[0.06] dark:bg-[#0e0e0e]"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border-0 bg-transparent px-2 text-[0.875rem] text-foreground placeholder:text-placeholder-foreground focus:ring-0 focus:outline-none"
          placeholder="Send a command or ask Letora Intelligence..."
          type="search"
          name="command"
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2 px-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/settings")}
            className="flex items-center gap-2 rounded-[6px] bg-muted px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-foreground transition-colors duration-200 ease-out hover:bg-muted/90 dark:bg-[#2a2a2a] dark:text-white dark:hover:bg-[#353534]"
          >
            <Calendar className="size-4" aria-hidden />
            Sync my calendar
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/leads")}
            className="flex items-center gap-2 rounded-[6px] bg-muted px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-foreground transition-colors duration-200 ease-out hover:bg-muted/90 dark:bg-[#2a2a2a] dark:text-white dark:hover:bg-[#353534]"
          >
            <Presentation className="size-4" aria-hidden />
            Create a pitch deck
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/settings")}
            className="flex items-center gap-2 rounded-[6px] bg-muted px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-foreground transition-colors duration-200 ease-out hover:bg-muted/90 dark:bg-[#2a2a2a] dark:text-white dark:hover:bg-[#353534]"
          >
            <Layers className="size-4" aria-hidden />
            Initialize UI system
          </button>
        </div>
      </form>
    </section>
  );
}
