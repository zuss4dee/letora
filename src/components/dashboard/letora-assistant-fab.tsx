"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

export function LetoraAssistantFab() {
  return (
    <Link
      href="/dashboard"
      className="fixed bottom-8 right-8 z-50 flex size-14 items-center justify-center rounded-md bg-gradient-to-tr from-[#BD9952] to-[#d4a85c] shadow-[0_20px_40px_rgba(189,153,82,0.2)] transition-transform duration-300 hover:scale-110"
      aria-label="Open Letora assistant"
    >
      <Sparkles className="size-7 text-[#2c1e00]" fill="currentColor" strokeWidth={1} aria-hidden />
    </Link>
  );
}
