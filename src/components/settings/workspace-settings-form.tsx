"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { saveSettings, type UserSettingsRow } from "@/lib/actions/user-settings";
import { type UserSettingsInput, userSettingsSchema } from "@/lib/validations/user-settings";
import { cn } from "@/lib/utils";

type Props = {
  initialValues: UserSettingsInput;
  metadata: Partial<UserSettingsRow>;
  userId: string;
};

export function WorkspaceSettingsForm({ initialValues, metadata, userId }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UserSettingsInput>({
    resolver: zodResolver(userSettingsSchema) as Resolver<UserSettingsInput>,
    defaultValues: initialValues,
  });

  async function onSubmit(values: UserSettingsInput) {
    setIsSubmitting(true);
    try {
      const result = await saveSettings(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Settings saved successfully.");
      router.refresh();
    } catch (err) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDirty = form.formState.isDirty;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-6xl mx-auto space-y-12 pb-24">
      {/* 01. NAVIGATION & ACTIONS */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#0b0b0b]/80 backdrop-blur-md py-6 border-b border-zinc-800/50">
        <div className="space-y-1">
          <h1 className="text-[16px] font-black tracking-tight text-white uppercase italic">Workspace Settings</h1>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{metadata.businessName || "Workspace Root"}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isDirty && (
            <button
              type="button"
              onClick={() => form.reset()}
              className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
            >
              Discard Changes
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className={cn(
              "px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all border",
              isDirty 
                ? "bg-white text-black border-white hover:bg-zinc-200" 
                : "bg-transparent text-zinc-700 border-zinc-800 cursor-not-allowed"
            )}
          >
            {isSubmitting ? "Syncing..." : "Save Changes"}
          </button>
        </div>
      </header>

      {/* 02. CORE WORKSPACE & BILLING SUMMARY */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-zinc-600">business</span>
          <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Workspace & Subscription</h2>
        </div>
        <div className="grid grid-cols-12 gap-px bg-zinc-800 border border-zinc-800/50 overflow-hidden">
          {/* Workspace Name */}
          <div className="col-span-12 md:col-span-6 bg-[#111111] p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black border border-zinc-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px] text-zinc-600">domain</span>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Public Workspace Name</label>
                <input
                  {...form.register("businessName")}
                  className="w-full bg-transparent text-[13px] font-bold text-white outline-none placeholder:text-zinc-700 focus:text-emerald-400 transition-colors"
                  placeholder="Primary workspace name..."
                />
              </div>
            </div>
          </div>
          {/* Billing Quick Look */}
          <div className="col-span-12 md:col-span-6 bg-[#111111] p-6 flex items-center justify-between">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Active Tier</p>
                <p className="text-[13px] font-black text-white uppercase">{metadata.subscriptionPlan || "Standard"}</p>
              </div>
            </div>
            <div className="text-right space-y-4">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Billing Status</p>
                <div className="flex items-center gap-2 justify-end">
                  <span className={cn("w-1.5 h-1.5 rounded-full", metadata.subscriptionStatus === "active" ? "bg-emerald-500" : "bg-zinc-700")} />
                  <p className="text-[13px] font-black text-white uppercase">{metadata.subscriptionStatus || "Active"}</p>
                </div>
              </div>
            </div>
            <div className="pl-8">
              <button 
                type="button"
                onClick={() => router.push("/dashboard/billing")}
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-[10px] font-black uppercase text-white hover:bg-white hover:text-black transition-all"
              >
                Go to Billing
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 03. ACCOUNT PROFILE */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-zinc-600">account_circle</span>
          <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Account Profile</h2>
        </div>
        <div className="bg-[#111111] border border-zinc-800/50 p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="group space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest group-focus-within:text-white transition-colors">Primary Contact Name</label>
              <input
                {...form.register("landlordName")}
                className="w-full bg-black border border-zinc-800 p-3 text-[12px] text-white focus:border-white outline-none transition-all"
                placeholder="Full legal name"
              />
            </div>
            <div className="group space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest group-focus-within:text-white transition-colors">Operational Email</label>
              <input
                {...form.register("contactEmail")}
                className="w-full bg-black border border-zinc-800 p-3 text-[12px] text-white focus:border-white outline-none transition-all"
                placeholder="email@example.com"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 04. SECURITY & INTEGRATIONS */}
      <section className="grid grid-cols-12 gap-8">
        {/* Security Summary */}
        <div className="col-span-12 md:col-span-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[16px] text-zinc-600">shield</span>
            <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Security Protocol</h2>
          </div>
          <div className="bg-[#111111] border border-zinc-800/50 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-white uppercase tracking-tight">Two-Factor Auth</p>
                <p className="text-[9px] text-zinc-500 uppercase font-black">Managed via Auth Provider</p>
              </div>
              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[9px] font-black uppercase border border-zinc-700">Protected</span>
            </div>
          </div>
        </div>

        {/* Integration Status */}
        <div className="col-span-12 md:col-span-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[16px] text-zinc-600">cable</span>
            <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Active Integrations</h2>
          </div>
          <div className="bg-[#111111] border border-zinc-800/50 p-6">
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-black border border-zinc-800 flex items-center justify-center font-black text-[11px] text-zinc-500 group-hover:text-white transition-colors italic underline">S</div>
                <div className="space-y-0.5">
                  <p className="text-[11px] font-bold text-white uppercase">Stripe Connect</p>
                  <p className="text-[9px] text-zinc-500 uppercase font-black tracking-tighter">Financial Settlement Node</p>
                </div>
              </div>
              {metadata.stripeConnectAccountId || metadata.stripeCustomerId ? (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 border border-emerald-900/50 bg-emerald-950/20 text-emerald-500">Live</span>
              ) : (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 border border-zinc-800 bg-black text-zinc-600">Disabled</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 05. TERMINATION ZONE */}
      <footer className="border-t border-red-950/50 pt-12">
        <div className="bg-red-950/5 border border-red-950/20 p-8 flex items-center justify-between">
          <div className="space-y-2">
            <h2 className="text-[12px] font-black text-red-500 uppercase tracking-[0.2em]">Permanent Deletion</h2>
            <p className="text-[10px] text-red-900/60 max-w-lg font-medium leading-relaxed uppercase tracking-tighter">
              Executing this operation will result in the immediate and permanent erasure of all property records, 
              tenant identifiers, and historical transaction logs. 
            </p>
          </div>
          <button type="button" className="px-8 py-3 bg-red-950/20 border border-red-950/40 text-[10px] font-black uppercase text-red-500 hover:bg-red-500 hover:text-white transition-all tracking-[0.2em]">
            Destroy Workspace
          </button>
        </div>
      </footer>
    </form>
  );
}
