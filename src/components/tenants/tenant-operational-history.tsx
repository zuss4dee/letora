"use client";

import { cn } from "@/lib/utils";

function formatRelativeTime(date: string | Date) {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Mirrors `TenantProfileActivityRow` from server loader (kept local to avoid client importing `use server` modules). */
type TenantOperationalActivityEntry = {
  id: string;
  tool_name: string;
  args: unknown;
  result: unknown;
  success: boolean;
  created_at: string;
  source: string | null;
};

interface TenantOperationalHistoryProps {
  activity: TenantOperationalActivityEntry[];
}

export function TenantOperationalHistory({ activity }: TenantOperationalHistoryProps) {
  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-border dark:border-[#232323] py-12 text-center">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600">
          No operational history found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activity.map((entry) => (
        <div key={entry.id} className="relative pl-6">
          <div
            className={cn(
              "absolute left-0 top-1.5 h-2 w-2 rounded-full",
              entry.source === "landlord" ? "bg-white" : "bg-emerald-500",
              !entry.success && "bg-rose-500"
            )}
          />
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-200">
                {entry.tool_name.replace(/_/g, " ").toUpperCase()}
              </span>
              <span className="text-[9px] font-medium uppercase tracking-tighter text-zinc-600">
                {formatRelativeTime(entry.created_at)}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              {entry.source === "assistant" ? "Assistant" : "Landlord"} executed this action successfully.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
