"use client";

import { useRouter } from "next/navigation";
import { UserSettingsRow } from "@/lib/actions/user-settings";
import { formatSubscriptionDate } from "@/lib/billing/subscription-display";
import { cn } from "@/lib/utils";

type Props = {
  settings: Partial<UserSettingsRow> | null;
  hasStripeCustomer: boolean;
  hasPolarCustomer: boolean;
};

export function WorkspaceBillingView({ settings, hasStripeCustomer, hasPolarCustomer }: Props) {
  const router = useRouter();
  
  const status = settings?.subscriptionStatus?.toLowerCase() || "inactive";
  const plan = settings?.subscriptionPlan || "Standard";
  const renewalDate = settings?.subscriptionPeriodEnd 
    ? new Date(settings?.subscriptionPeriodEnd).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })
    : "N/A";

  const billingProvider = hasPolarCustomer ? "Polar" : "Stripe";

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-24">
      {/* 01. HEADER */}
      <header className="flex items-center justify-between bg-[#0b0b0b]/80 backdrop-blur-md py-6 border-b border-zinc-800/50 sticky top-0 z-20">
        <div className="space-y-1">
          <h1 className="text-[16px] font-black tracking-tight text-white uppercase italic">Financial Operations</h1>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Subscription Ledger</p>
          </div>
        </div>
        <button 
          onClick={() => router.push("/dashboard/settings")}
          className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
        >
          Back to Settings
        </button>
      </header>

      {/* 02. PLAN SUMMARY GRID */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-zinc-600">receipt_long</span>
          <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Active Subscription</h2>
        </div>
        
        <div className="grid grid-cols-12 gap-px bg-zinc-800 border border-zinc-800/50 overflow-hidden">
          {/* Main Plan Card */}
          <div className="col-span-12 md:col-span-8 bg-[#111111] p-8 space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Workspace Tier</p>
                <p className="text-[24px] font-black text-white tracking-tight uppercase italic">{plan}</p>
              </div>
              <div className="text-right space-y-2">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Current Status</p>
                <div className="flex items-center gap-2 justify-end">
                  <span className={cn("w-2 h-2 rounded-full", status === "active" ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-zinc-700")} />
                  <p className="text-[14px] font-black text-white uppercase">{status}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-12 pt-8 border-t border-zinc-800/50">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Next Invoice Date</p>
                <p className="text-[13px] font-bold text-white">{renewalDate}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Billing Method</p>
                <p className="text-[13px] font-bold text-white uppercase">{billingProvider} Secure Settlement</p>
              </div>
            </div>
          </div>

          {/* Actions / Portal */}
          <div className="col-span-12 md:col-span-4 bg-[#141414] p-8 flex flex-col justify-between border-l border-zinc-800/50">
            <div className="space-y-4">
              <p className="text-[10px] text-zinc-500 leading-relaxed uppercase font-bold tracking-tighter">
                Manage your card details, view historical invoices, or adjust your operational tier via the secure customer portal.
              </p>
            </div>
            <div className="space-y-2 pt-8">
              <button className="w-full py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
                Access Billing Portal
              </button>
              <button className="w-full py-3 bg-transparent border border-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-white transition-all">
                Download Latest Invoice
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 03. USAGE & LIMITS - DATA TYPE */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-zinc-600">monitoring</span>
          <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Operational Capacity</h2>
        </div>
        <div className="bg-[#111111] border border-zinc-800/50 p-8 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Portfolio Units</p>
              <p className="text-[11px] font-bold text-white">12 / 25</p>
            </div>
            <div className="w-full h-1 bg-zinc-900 overflow-hidden">
              <div className="w-[48%] h-full bg-white" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Active Tenancies</p>
              <p className="text-[11px] font-bold text-white">8 / Unlimited</p>
            </div>
            <div className="w-full h-1 bg-zinc-900 overflow-hidden">
              <div className="w-full h-full bg-emerald-500" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Agent Automations</p>
              <p className="text-[11px] font-bold text-white">Full Access</p>
            </div>
            <div className="w-full h-1 bg-emerald-500/20" />
          </div>
        </div>
      </section>

      {/* 04. HISTORY PLACEHOLDER - HONEST TREATMENT */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] text-zinc-600">history</span>
          <h2 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Transaction History</h2>
        </div>
        <div className="bg-[#111111] border border-zinc-800/50 border-dashed p-8 text-center space-y-2">
          <p className="text-[11px] font-bold text-zinc-600 uppercase">Archive synchronization in progress</p>
          <p className="text-[9px] text-zinc-700 uppercase tracking-tighter">Detailed line-item history is available in your primary billing portal.</p>
        </div>
      </section>
    </div>
  );
}
