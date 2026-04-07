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
      router.push("/dashboard/assistant");
    },
    [router],
  );

  return (
    <section className={cn("relative", className)}>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-[6px] border border-white/[0.06] bg-[#0e0e0e] p-4 shadow-sm"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border-0 bg-transparent px-2 text-[0.875rem] text-white placeholder:text-neutral-600 focus:ring-0 focus:outline-none"
          placeholder="Send a command or ask Letora Intelligence..."
          type="search"
          name="command"
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2 px-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/settings")}
            className="flex items-center gap-2 rounded-[6px] bg-[#2a2a2a] px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#353534]"
          >
            <Calendar className="size-4" aria-hidden />
            Sync my calendar
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/leads")}
            className="flex items-center gap-2 rounded-[6px] bg-[#2a2a2a] px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#353534]"
          >
            <Presentation className="size-4" aria-hidden />
            Create a pitch deck
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/settings")}
            className="flex items-center gap-2 rounded-[6px] bg-[#2a2a2a] px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#353534]"
          >
            <Layers className="size-4" aria-hidden />
            Initialize UI system
          </button>
        </div>
      </form>
    </section>
  );
}
