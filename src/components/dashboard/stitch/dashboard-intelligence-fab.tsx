"use client";

import Link from "next/link";

import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export function DashboardIntelligenceFab({ className }: { className?: string }) {
  return (
    <Link
      href="/dashboard/assistant"
      className={cn(
        "fixed bottom-8 right-8 z-40 flex size-12 items-center justify-center rounded-full bg-white text-[#1a1c1c] shadow-2xl transition-transform active:scale-95",
        className,
      )}
      aria-label="Open Intelligence"
    >
      <Plus className="size-6" strokeWidth={2.5} aria-hidden />
    </Link>
  );
}
