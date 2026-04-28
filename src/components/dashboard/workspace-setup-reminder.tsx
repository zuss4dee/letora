"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Circle, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { dismissWorkspaceSetupReminder } from "@/lib/actions/user-onboarding";
import type { WorkspaceSetupPendingItem } from "@/lib/onboarding/workspace-setup";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WorkspaceSetupReminder({
  items,
  className,
}: {
  items: WorkspaceSetupPendingItem[];
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (items.length === 0) return null;

  async function onDismiss() {
    setBusy(true);
    try {
      const res = await dismissWorkspaceSetupReminder();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const n = items.length;

  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-5 shadow-sm dark:border-amber-500/25 dark:bg-amber-500/[0.04]",
        className,
      )}
      role="region"
      aria-label="Workspace setup to-do list"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-500">
            Finish your setup
          </p>
          <p className="font-headline text-xs font-medium tabular-nums text-muted-foreground">
            {n} {n === 1 ? "task" : "tasks"} left
          </p>
          <p className="font-headline text-sm font-light leading-relaxed text-foreground">
            Work through these when you can — Letora works best with profile, properties, tenancies, and compliance in
            good shape.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => void onDismiss()}
          disabled={busy}
          aria-label="Hide this to-do list"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
        </Button>
      </div>

      <ul className="mt-4 space-y-1 border-t border-amber-500/10 pt-4 dark:border-amber-500/10">
        {items.map((t) => (
          <li key={t.id}>
            <Link
              href={t.href}
              className="flex items-start gap-3 rounded-lg py-2 transition-colors hover:bg-amber-500/[0.08]"
            >
              <Circle className="mt-0.5 size-5 shrink-0 text-amber-500" strokeWidth={1.75} aria-hidden />
              <span className="font-headline text-sm font-light leading-snug text-foreground">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
