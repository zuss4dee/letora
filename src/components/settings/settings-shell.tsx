"use client";

import {
  Bell,
  Building2,
  Mail,
  Palette,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useCallback, useState } from "react";

import { AiChaseSettings } from "@/components/settings/ai-chase-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { EmailTemplateSettings } from "@/components/settings/email-template-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { OrganisationSettings } from "@/components/settings/organisation-settings";
import { ProfileSettings } from "@/components/settings/profile-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  type AiChaseSettingsInput,
  type EmailTemplatesSettingsInput,
  type NotificationSettingsInput,
  type OrganisationSettingsInput,
  type ProfileSettingsInput,
  type ThemePreference,
} from "@/lib/validations/user-settings";

type TabId =
  | "organisation"
  | "profile"
  | "ai"
  | "email"
  | "notifications"
  | "appearance";

const TABS: ReadonlyArray<{
  id: TabId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "organisation",
    label: "Organisation",
    description: "Brand, contact details, logo",
    icon: Building2,
  },
  {
    id: "profile",
    label: "Profile",
    description: "Your name, email, password",
    icon: UserRound,
  },
  {
    id: "ai",
    label: "AI & Chasing",
    description: "Rent chaser rules and tone",
    icon: Sparkles,
  },
  {
    id: "email",
    label: "Email templates",
    description: "Subjects, bodies, sender",
    icon: Mail,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts, digest schedule",
    icon: Bell,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme preference",
    icon: Palette,
  },
];

export type SettingsShellInitialValues = {
  organisation: OrganisationSettingsInput;
  profile: ProfileSettingsInput;
  aiChase: AiChaseSettingsInput;
  emailTemplates: EmailTemplatesSettingsInput;
  notifications: NotificationSettingsInput;
  appearance: ThemePreference;
};

export function SettingsShell({
  initial,
  authEmail,
  loadFailed = false,
}: {
  initial: SettingsShellInitialValues;
  authEmail: string;
  /** When true, settings could not be read from the database — fields show defaults. */
  loadFailed?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("organisation");
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [dirtyByTab, setDirtyByTab] = useState<Record<TabId, boolean>>({
    organisation: false,
    profile: false,
    ai: false,
    email: false,
    notifications: false,
    appearance: false,
  });

  const setDirty = useCallback(
    (tab: TabId) => (dirty: boolean) => {
      setDirtyByTab((prev) => (prev[tab] === dirty ? prev : { ...prev, [tab]: dirty }));
    },
    [],
  );

  function requestTabChange(next: TabId) {
    if (next === activeTab) return;
    if (dirtyByTab[activeTab]) {
      setPendingTab(next);
      return;
    }
    setActiveTab(next);
  }

  function confirmLeave() {
    if (!pendingTab) return;
    setDirtyByTab((prev) => ({ ...prev, [activeTab]: false }));
    setActiveTab(pendingTab);
    setPendingTab(null);
  }

  const activeTabLabel = TABS.find((t) => t.id === activeTab)?.label ?? "this tab";

  function cancelLeave() {
    setPendingTab(null);
  }

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-[#0B0B0B]">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mb-8 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Settings
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Manage your organisation, AI agents, communication preferences, and how Letora looks.
          </p>
          {loadFailed ? (
            <div
              role="alert"
              className="mt-4 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100"
            >
              Could not load your settings. Showing defaults.
            </div>
          ) : null}
        </header>

        {/* Mobile pill navigation */}
        <nav
          aria-label="Settings sections"
          className="sticky top-0 z-10 -mx-4 mb-6 overflow-x-auto bg-zinc-50/95 px-4 py-2 backdrop-blur md:hidden dark:bg-[#0B0B0B]/95"
        >
          <ul className="flex w-max gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeTab;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => requestTabChange(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-[#2a2a2a] dark:bg-[#161616] dark:text-zinc-300 dark:hover:bg-[#1f1f1f]",
                    )}
                  >
                    <Icon className="size-4" />
                    {tab.label}
                    {dirtyByTab[tab.id] && !active ? (
                      <span className="size-1.5 rounded-full bg-amber-500" aria-label="Unsaved changes" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)]">
          {/* Desktop vertical nav */}
          <aside className="hidden md:block">
            <nav aria-label="Settings sections" className="sticky top-8">
              <ul className="space-y-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = tab.id === activeTab;
                  return (
                    <li key={tab.id}>
                      <button
                        type="button"
                        onClick={() => requestTabChange(tab.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                          active
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#161616]",
                        )}
                      >
                        <Icon
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            active ? "" : "text-zinc-400 dark:text-zinc-500",
                          )}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-medium">{tab.label}</span>
                            {dirtyByTab[tab.id] && !active ? (
                              <span className="size-1.5 rounded-full bg-amber-500" aria-label="Unsaved changes" />
                            ) : null}
                          </span>
                          <span
                            className={cn(
                              "block truncate text-xs",
                              active ? "text-white/80 dark:text-zinc-700" : "text-zinc-500 dark:text-zinc-500",
                            )}
                          >
                            {tab.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <section className="min-w-0">
            <div className={cn(activeTab === "organisation" ? "block" : "hidden")}>
              <OrganisationSettings
                initialValues={initial.organisation}
                onDirtyChange={setDirty("organisation")}
              />
            </div>
            <div className={cn(activeTab === "profile" ? "block" : "hidden")}>
              <ProfileSettings
                initialValues={initial.profile}
                authEmail={authEmail}
                onDirtyChange={setDirty("profile")}
              />
            </div>
            <div className={cn(activeTab === "ai" ? "block" : "hidden")}>
              <AiChaseSettings
                initialValues={initial.aiChase}
                onDirtyChange={setDirty("ai")}
              />
            </div>
            <div className={cn(activeTab === "email" ? "block" : "hidden")}>
              <EmailTemplateSettings
                initialValues={initial.emailTemplates}
                onDirtyChange={setDirty("email")}
              />
            </div>
            <div className={cn(activeTab === "notifications" ? "block" : "hidden")}>
              <NotificationSettings
                initialValues={initial.notifications}
                onDirtyChange={setDirty("notifications")}
              />
            </div>
            <div className={cn(activeTab === "appearance" ? "block" : "hidden")}>
              <AppearanceSettings
                initialValue={initial.appearance}
                onDirtyChange={setDirty("appearance")}
              />
            </div>
          </section>
        </div>
      </div>

      <Dialog open={pendingTab !== null} onOpenChange={(open) => !open && cancelLeave()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You have unsaved changes in {activeTabLabel}</DialogTitle>
            <DialogDescription>Leave without saving?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={cancelLeave}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-[#2a2a2a] dark:bg-transparent dark:text-zinc-100 dark:hover:bg-[#1f1f1f]"
            >
              Stay and save
            </button>
            <button
              type="button"
              onClick={confirmLeave}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Leave anyway
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
