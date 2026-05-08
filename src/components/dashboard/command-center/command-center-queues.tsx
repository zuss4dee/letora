import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";

import { CommandCenterArrearsQueueList } from "@/components/dashboard/command-center/command-center-arrears-queue-list";
import {
  loadCommandCenterArrearsQueue,
  loadCommandCenterMaintenanceQueue,
  type MaintenanceQueueRow,
} from "@/lib/dashboard/command-center-queries";
import { cn } from "@/lib/utils";

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

function maintenanceQueueRowHref(row: MaintenanceQueueRow): string {
  const params = new URLSearchParams();
  params.set("issueId", row.id);
  return `/dashboard/maintenance?${params.toString()}`;
}

export async function CommandCenterArrearsQueue({ userId }: { userId: string }) {
  const rows = await loadCommandCenterArrearsQueue(userId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="size-1.5 bg-[#ffb4ab]" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-white">Late rent — needs action</h2>
        {rows.length > 0 ? (
          <span className="inline-flex min-h-[1.25rem] min-w-[1.5rem] items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-900/50 px-2 font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
            {rows.length}
          </span>
        ) : null}
      </div>

      <div className="border border-[#333333] bg-[#161616]">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-1">You’re up to date here</p>
            <p className="font-mono text-[10px] uppercase text-zinc-700">
              No late payments need action right now.
            </p>
          </div>
        ) : (
          <CommandCenterArrearsQueueList rows={rows} />
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
            <p className="font-mono text-[10px] uppercase text-zinc-700">
              Queue is clear — no issues need contractor outreach right now.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#282828]">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={maintenanceQueueRowHref(row)}
                aria-label={`Open maintenance case: ${row.summary}`}
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
                    <p
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5",
                        ["high", "urgent"].includes((row.urgency ?? "").toLowerCase())
                          ? "bg-[#93000a] text-[#ffdad6]"
                          : "bg-zinc-800 text-zinc-400",
                      )}
                    >
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
