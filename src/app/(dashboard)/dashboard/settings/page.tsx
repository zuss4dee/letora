/**
 * Settings panel — backed by `user_settings` (see migration
 * `20260710120000_user_settings_full_panel.sql`). Loaders aggregate every tab;
 * persistence lives in `src/lib/actions/user-settings.ts` and
 * `./actions.ts`.
 */

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { SettingsShell } from "@/components/settings/settings-shell";
import { createClient } from "@/lib/supabase/server";

import { loadAllSettings } from "./loaders";

function SettingsSkeleton() {
  return (
    <div className="min-h-full bg-zinc-50 px-4 py-8 dark:bg-[#0B0B0B] sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="h-7 w-40 animate-pulse rounded bg-zinc-200 dark:bg-[#161616]" />
        <div className="h-4 w-80 animate-pulse rounded bg-zinc-200 dark:bg-[#161616]" />
        <div className="grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="hidden h-72 animate-pulse rounded-xl bg-zinc-200 md:block dark:bg-[#161616]" />
          <div className="h-96 animate-pulse rounded-xl bg-zinc-200 dark:bg-[#161616]" />
        </div>
      </div>
    </div>
  );
}

async function SettingsAsync() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) redirect("/login");

  const meta =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : undefined;

  const { initial, loadFailed } = await loadAllSettings(user.id, user.email ?? "", meta);

  return (
    <SettingsShell initial={initial} authEmail={user.email ?? ""} loadFailed={loadFailed} />
  );
}

export default function SettingsPage() {
  return (
    <div className="@container/main relative flex flex-1 flex-col bg-zinc-50 text-zinc-950 dark:bg-[#0B0B0B] dark:text-zinc-100">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsAsync />
      </Suspense>
    </div>
  );
}
