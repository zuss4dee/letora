import Link from "next/link";
import { AlertCircle, ChevronRight, Clock, Mail, MessageSquare, Wrench } from "lucide-react";

import { 
  loadCommandCenterArrearsQueue, 
  loadCommandCenterMaintenanceQueue,
  ArrearsQueueRow,
  MaintenanceQueueRow
} from "@/lib/dashboard/command-center-queries";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    approval_needed: { label: "Approval Needed", className: "bg-[#93000a] text-[#ffdad6]" },
    draft_ready: { label: "Draft Ready", className: "bg-[#afefdd]/10 text-[#afefdd] border border-[#afefdd]/20" },
    sent: { label: "Sent", className: "bg-zinc-800 text-zinc-400" },
    no_draft: { label: "No Action", className: "bg-zinc-900 text-zinc-600" },
    not_started: { label: "Not Started", className: "bg-zinc-900 text-zinc-600" },
  };

  const config = map[status] || { label: status, className: "bg-zinc-800 text-zinc-400" };

  return (
    <span className={cn("px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", config.className)}>
      {config.label}
    </span>
  );
}

function arrearsRowHref(row: ArrearsQueueRow): string {
  const params = new URLSearchParams();
  params.set("paymentId", row.id);
  if (row.tenancyId) params.set("tenancyId", row.tenancyId);
  return `/dashboard/rent-tracker?${params.toString()}`;
}

function maintenanceQueueRowHref(row: MaintenanceQueueRow): string {
  const params = new URLSearchParams();
  params.set("issueId", row.id);
  return `/dashboard/maintenance?${params.toString()}`;
}

export async function CommandCenterArrearsQueue({ userId }: { userId: string }) {
  const rows = await loadCommandCenterArrearsQueue(userId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="size-1.5 bg-[#ffb4ab]" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-white">Overdue Rent Action Queue</h2>
      </div>
      
      <div className="border border-[#333333] bg-[#161616]">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1">0 Overdue Rent Cases</p>
            <p className="font-mono text-[10px] uppercase text-zinc-700">All accounts are currently up to date.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#282828]">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={arrearsRowHref(row)}
                className="group flex items-center justify-between p-4 transition-colors hover:bg-[#242424]"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center bg-zinc-900 text-[#ffb4ab]">
                    <AlertCircle className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{row.tenantName}</p>
                    <p className="font-mono text-[10px] uppercase text-zinc-500 truncate">{row.propertyAddress}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right hidden sm:block">
                    <p className="text-[13px] font-bold text-white tabular-nums">{formatMoney(row.amountOverdue)}</p>
                    <p className="font-mono text-[9px] uppercase text-zinc-500">{row.daysOverdue} Days Late</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={row.actionState} />
                    <ChevronRight className="size-4 text-zinc-700 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export async function CommandCenterMaintenanceQueue({ userId }: { userId: string }) {
  const rows = await loadCommandCenterMaintenanceQueue(userId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="size-1.5 bg-zinc-400" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-white">Maintenance Action Queue</h2>
      </div>

      <div className="border border-[#333333] bg-[#161616]">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1">No Maintenance Exceptions</p>
            <p className="font-mono text-[10px] uppercase text-zinc-700">0 issues awaiting contractor outreach.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#282828]">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={maintenanceQueueRowHref(row)}
                className="group flex items-center justify-between p-4 transition-colors hover:bg-[#242424]"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center bg-zinc-900 text-zinc-400">
                    <Wrench className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{row.summary}</p>
                    <p className="font-mono text-[10px] uppercase text-zinc-500 truncate">{row.propertyContext}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right hidden md:block">
                    <p className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5", 
                      row.urgency.toLowerCase() === 'high' ? 'text-[#ffdad6] bg-[#93000a]' : 'text-zinc-400 bg-zinc-800')}>
                      {row.urgency}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={row.actionState} />
                    <ChevronRight className="size-4 text-zinc-700 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommandCenterQueueSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 w-48 bg-zinc-800 rounded" />
      <div className="h-64 border border-[#333333] bg-[#161616]" />
    </div>
  );
}
