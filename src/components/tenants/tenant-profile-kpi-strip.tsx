"use client";

import { cn } from "@/lib/utils";

interface TenantProfileKpiStripProps {
  stats: {
    status: string | null;
    monthlyRent: number | null;
    arrears: number;
    openMaintenance: number;
    pendingApprovals: number;
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

export function TenantProfileKpiStrip({ stats }: TenantProfileKpiStripProps) {
  const items = [
    {
      label: "Tenancy Status",
      value: stats.status ?? "Inactive",
      tone: stats.status?.toLowerCase() === "active" ? "emerald" : "zinc",
    },
    {
      label: "Monthly Rent",
      value: stats.monthlyRent != null ? formatCurrency(stats.monthlyRent) : "—",
      tone: "zinc",
    },
    {
      label: "Arrears Amount",
      value: formatCurrency(stats.arrears),
      tone: stats.arrears > 0 ? "rose" : "zinc",
    },
    {
      label: "Maintenance",
      value: `${stats.openMaintenance} Open`,
      tone: stats.openMaintenance > 0 ? "amber" : "zinc",
    },
    {
      label: "Approvals",
      value: `${stats.pendingApprovals} Pending`,
      tone: stats.pendingApprovals > 0 ? "amber" : "zinc",
    },
  ];

  return (
    <div className="grid shrink-0 grid-cols-2 border-b border-[#232323] bg-[#0B0B0B] sm:grid-cols-5">
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col border-r border-[#232323] p-4 last:border-r-0",
            i >= 4 && "hidden sm:flex",
            i === 1 && "border-r-0 sm:border-r"
          )}
        >
          <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
            {item.label}
          </span>
          <span
            className={cn(
              "text-[15px] font-bold tabular-nums uppercase tracking-tight",
              item.tone === "emerald" ? "text-emerald-400" :
              item.tone === "rose" ? "text-rose-400" :
              item.tone === "amber" ? "text-amber-400" : "text-white"
            )}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
