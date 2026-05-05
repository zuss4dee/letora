import Link from "next/link";
import { Sparkles, Upload, MessageSquare, ChevronRight } from "lucide-react";

export function CommandCenterOnboardingHero() {
  return (
    <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="relative overflow-hidden border border-[#333333] bg-[#161616] p-8 md:p-12">
        {/* Subtle background decoration */}
        <div className="absolute -right-20 -top-20 size-80 rounded-full bg-white/[0.02] blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-60 rounded-full bg-white/[0.01] blur-3xl" />

        <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center border border-[#333333] bg-[#0B0B0B]">
                <Sparkles className="size-5 text-white" />
              </div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Operational Initialization
              </span>
            </div>

            <h2 className="font-['Inter',sans-serif] text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
              Your portfolio, <br />
              <span className="text-zinc-500">managed by agents.</span>
            </h2>

            <p className="mt-6 max-w-xl text-sm leading-relaxed text-zinc-400 md:text-base">
              Letora is an agentic platform designed to handle the heavy lifting of landlord operations. 
              Import your portfolio data, and our specialized agents will begin auditing leases, 
              tracking rent, and managing maintenance automatically.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/dashboard/import"
                className="group flex items-center gap-3 bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-zinc-200"
              >
                <Upload className="size-4" />
                Import Portfolio
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-3 border border-[#333333] px-8 py-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#242424]"
              >
                <MessageSquare className="size-4" />
                Talk to Assistant
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="space-y-6">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Initial Deployment Steps
              </h3>
              
              <div className="space-y-3">
                {[
                  { step: "01", label: "Import Data", desc: "Upload your property and tenant CSV", status: "READY" },
                  { step: "02", label: "Agent Dispatch", desc: "AI agents begin processing records", status: "WAITING" },
                  { step: "03", label: "Review Approvals", desc: "Validate agent actions and exceptions", status: "WAITING" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4 border border-[#333333] bg-[#0B0B0B] p-4">
                    <span className="font-mono text-[10px] font-black text-zinc-600">{item.step}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white">{item.label}</p>
                        <span className={`font-mono text-[9px] ${item.status === 'READY' ? 'text-[#afefdd]' : 'text-zinc-700'}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
