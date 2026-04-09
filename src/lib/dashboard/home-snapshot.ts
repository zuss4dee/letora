import { getProperties } from "@/lib/actions/properties";
import { getTenancies, type TenancyRow } from "@/lib/actions/tenancies";

function parseIsoDate(date: string | null) {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function classifyTenancyEnd(endDateIso: string | null): "active" | "expiring" | "expired" {
  const now = new Date();
  const end = parseIsoDate(endDateIso);
  if (!end) return "active";
  if (end.getTime() < now.getTime()) return "expired";
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  if (end.getTime() - now.getTime() <= sixtyDaysMs) return "expiring";
  return "active";
}

function isTenancyActiveRow(t: TenancyRow): boolean {
  const st = (t.status ?? "active").toLowerCase();
  if (st === "ended") return false;
  return classifyTenancyEnd(t.endDate) !== "expired";
}

/** High-level counts for the dashboard home (landing) view. */
export async function getHomePortfolioSnapshot(userId: string): Promise<{
  totalProperties: number;
  activeTenancies: number;
}> {
  const [properties, tenancies] = await Promise.all([
    getProperties(userId),
    getTenancies(userId),
  ]);
  return {
    totalProperties: properties.length,
    activeTenancies: tenancies.filter(isTenancyActiveRow).length,
  };
}
