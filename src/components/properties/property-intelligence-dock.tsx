"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PropertyIntelligenceDock({ insight }: { insight: string }) {
  const router = useRouter();
  const [text, setText] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    router.push(`/dashboard?q=${encodeURIComponent(q)}`);
    setText("");
  }

  return (
    <div className="fixed bottom-10 right-6 z-40 hidden w-[min(100vw-3rem,20rem)] border-b border-[#BD9952] bg-card/95 p-6 shadow-2xl backdrop-blur-xl ring-1 ring-border/60 dark:bg-[#252626]/80 md:bottom-12 md:right-12 md:block">
      <div className="mb-4 flex items-center gap-3">
        <span className="size-2 rounded-full bg-[#BD9952] shadow-[0_0_10px_#BD9952]" aria-hidden />
        <span className="font-[family-name:var(--font-inter)] text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#BD9952]">
          Letora Intelligence
        </span>
      </div>
      <p className="text-sm font-light italic leading-relaxed text-foreground">
        &ldquo;{insight}&rdquo;
      </p>
      <form onSubmit={onSubmit} className="mt-6">
        <label htmlFor="property-intelligence-cmd" className="sr-only">
          Command for Letora Assistant
        </label>
        <input
          id="property-intelligence-cmd"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a command…"
          className="w-full border-0 border-b border-border bg-transparent px-0 py-2 font-[family-name:var(--font-inter)] text-xs text-foreground placeholder:text-placeholder-foreground focus:border-[#BD9952] focus:outline-none"
        />
      </form>
    </div>
  );
}
