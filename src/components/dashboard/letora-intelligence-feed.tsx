import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  FileText,
  Mail,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import { normalizePropertyAddressLabel } from "@/lib/property-address";
import { cn } from "@/lib/utils";

import type { ActivityRun } from "@/components/dashboard/ai-activity-card";

function humanAgentName(agentType: string | null): string {
  const t = (agentType ?? "").toLowerCase();
  switch (t) {
    case "tenant_onboarding":
      return "Tenant onboarding";
    case "rent_chaser":
      return "Rent collection";
    case "contract_drafter":
      return "Contract";
    case "maintenance_agent":
    case "maintenance":
      return "Maintenance";
    case "safety_alert":
      return "Safety";
    case "lead_qualifier":
      return "Lead qualifier";
    default:
      if (!agentType) return "Agent";
      return agentType
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function extractActivitySubtitle(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const countRaw = p.count;
  const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
  if (Number.isFinite(count) && count > 0) {
    return `${count} lead${count === 1 ? "" : "s"} processed`;
  }
  const tenantName = pickString(p, ["tenantName", "tenant_name"]);
  const rawAddress = pickString(p, ["propertyAddress", "property_address"]);
  const propertyAddress = rawAddress ? normalizePropertyAddressLabel(rawAddress) : null;
  if (tenantName || propertyAddress) {
    return [tenantName, propertyAddress].filter(Boolean).join(" · ");
  }
  const issueSummary = pickString(p, ["issueSummary"]);
  if (issueSummary) return issueSummary;
  const triage = p.triage;
  if (triage && typeof triage === "object") {
    const summary = pickString(triage as Record<string, unknown>, ["summary"]);
    if (summary) return summary;
  }
  return null;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 7) return rtf.format(-diffDay, "day");
  return new Date(iso).toLocaleDateString("en-GB");
}

function iconForFeed(agentType: string | null): {
  Icon: typeof Bot;
  className: string;
} {
  const t = (agentType ?? "").toLowerCase();
  if (t === "rent_chaser") {
    return { Icon: CheckCircle2, className: "text-[#BD9952]" };
  }
  if (t === "contract_drafter") {
    return { Icon: FileText, className: "text-[#ACABAA]" };
  }
  if (t === "maintenance_agent" || t === "maintenance") {
    return { Icon: Wrench, className: "text-[#BB5551]" };
  }
  if (t === "safety_alert") {
    return { Icon: ShieldAlert, className: "text-[#BB5551]" };
  }
  return { Icon: Bot, className: "text-[#ACABAA]" };
}

export function LetoraIntelligenceFeed({ runs }: { runs: ActivityRun[] }) {
  const display = runs.slice(0, 4);

  return (
    <div className="space-y-3">
      {display.length === 0 ? (
        <p className="px-4 py-8 font-[family-name:var(--font-inter)] text-[0.8rem] text-[#ACABAA]">
          Nothing has run yet. Open{" "}
          <Link href="/dashboard" className="text-[#BD9952] underline-offset-4 hover:underline">
            Home
          </Link>{" "}
          to run rent chasers, lead qualification, onboarding, or contract drafts from Quick actions or ⌘K.
        </p>
      ) : (
        display.map((row) => {
          const { Icon, className } = iconForFeed(row.agent_type);
          const subtitle = extractActivitySubtitle(row.payload);
          const title = humanAgentName(row.agent_type);
          return (
            <div
              key={row.id}
              className="flex gap-4 p-4 transition-colors duration-300 hover:bg-[#131313]"
            >
              <div className="mt-0.5 shrink-0">
                <Icon className={cn("size-5 stroke-[1.25]", className)} aria-hidden />
              </div>
              <div>
                <p className="font-[family-name:var(--font-inter)] text-[0.8rem] leading-relaxed text-[#E7E5E4]">
                  <span className="font-medium text-[#C9C6C5]">{title}</span>
                  {subtitle ? (
                    <>
                      {" "}
                      — {subtitle}
                    </>
                  ) : null}
                </p>
                <span className="mt-2 block font-[family-name:var(--font-inter)] text-[0.625rem] uppercase tracking-widest text-[#484848]">
                  {formatRelativeTime(row.created_at)}
                </span>
              </div>
            </div>
          );
        })
      )}
      {runs.length > 4 ? (
        <div className="flex gap-4 p-4 opacity-50">
          <Mail className="mt-0.5 size-5 shrink-0 text-[#ACABAA]" aria-hidden />
          <p className="font-[family-name:var(--font-inter)] text-[0.8rem] text-[#ACABAA]">
            {runs.length - 4} more in the{" "}
            <Link href="/dashboard/activity" className="text-[#BD9952] underline-offset-4 hover:underline">
              full activity log
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
