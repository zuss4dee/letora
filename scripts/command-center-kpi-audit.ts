/**
 * Data audit: Command Center KPI buckets vs rent_payments rows for one landlord.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/command-center-kpi-audit.ts [userId]
 *
 * If userId is omitted, picks the first distinct properties.user_id from the DB (service role).
 */

import { createClient } from "@supabase/supabase-js";

import { isoDateBetweenInclusive, monthBoundsIso } from "../src/lib/rent-calendar-bounds";
import { isPaymentOverdue, resolvePaymentAmount } from "../src/lib/rent-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isPaidRentStatus(status: string | null): boolean {
  return (status ?? "").toLowerCase() === "paid";
}

type RawRow = {
  id: string;
  amount: unknown;
  status: string | null;
  due_date: string | null;
  paid_date: string | null;
  tenant_name: string | null;
  tenancy_id: string | null;
};

type Bucket =
  | "current_collected"
  | "current_outstanding"
  | "next_month_scheduled"
  | "last_collected"
  | "arrears_kpi"
  | "overdue_queue"
  | "none";

function bucketsForRow(
  todayIso: string,
  amt: number,
  p: { status: string | null; due_date: string | null; paid_date: string | null },
  current: { startIso: string; endIso: string },
  nextMonth: { startIso: string; endIso: string },
  lastMonth: { startIso: string; endIso: string },
): { buckets: Bucket[]; amt: number } {
  const due = (p.due_date ?? "").slice(0, 10);
  const paidIso = (p.paid_date ?? "").slice(0, 10);
  const buckets: Bucket[] = [];

  const overdueQ = isPaymentOverdue(p.status, p.due_date, todayIso);
  if (overdueQ) {
    buckets.push("overdue_queue");
  }
  if (overdueQ) {
    buckets.push("arrears_kpi");
  }

  if (due && isoDateBetweenInclusive(due, current.startIso, current.endIso) && !isPaidRentStatus(p.status)) {
    buckets.push("current_outstanding");
  }

  if (due && isoDateBetweenInclusive(due, nextMonth.startIso, nextMonth.endIso)) {
    buckets.push("next_month_scheduled");
  }

  if (isPaidRentStatus(p.status)) {
    if (paidIso && isoDateBetweenInclusive(paidIso, current.startIso, current.endIso)) {
      buckets.push("current_collected");
    } else if (!paidIso && due && isoDateBetweenInclusive(due, current.startIso, current.endIso)) {
      buckets.push("current_collected");
    }
    if (paidIso && isoDateBetweenInclusive(paidIso, lastMonth.startIso, lastMonth.endIso)) {
      buckets.push("last_collected");
    } else if (!paidIso && due && isoDateBetweenInclusive(due, lastMonth.startIso, lastMonth.endIso)) {
      buckets.push("last_collected");
    }
  }

  if (buckets.length === 0) {
    buckets.push("none");
  }

  return { buckets, amt };
}

async function main() {
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let userId = process.argv[2]?.trim();
  if (!userId) {
    const { data: row, error } = await supabase.from("properties").select("user_id").limit(1).maybeSingle();
    if (error || !row?.user_id) {
      console.error("Could not resolve default user_id:", error?.message);
      process.exit(1);
    }
    userId = row.user_id as string;
    console.log("(no userId arg) using first property owner:", userId);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const anchor = todayIso;
  const current = monthBoundsIso(anchor, 0);
  const nextMonth = monthBoundsIso(anchor, 1);
  const lastMonth = monthBoundsIso(anchor, -1);

  const dueFetchStart = monthBoundsIso(anchor, -24).startIso;
  const dueFetchEnd = monthBoundsIso(anchor, 12).endIso;
  const paidFetchStart = monthBoundsIso(anchor, -24).startIso;
  const paidFetchEnd = current.endIso;

  const sel = `
    id,
    amount,
    status,
    due_date,
    paid_date,
    tenancies!inner (
      id,
      tenants ( full_name ),
      properties!inner ( user_id, address )
    )
  `;

  const [dueRes, paidRes] = await Promise.all([
    supabase
      .from("rent_payments")
      .select(sel)
      .eq("tenancies.properties.user_id", userId)
      .gte("due_date", dueFetchStart)
      .lte("due_date", dueFetchEnd),
    supabase
      .from("rent_payments")
      .select(sel)
      .eq("tenancies.properties.user_id", userId)
      .not("paid_date", "is", null)
      .gte("paid_date", paidFetchStart)
      .lte("paid_date", paidFetchEnd),
  ]);

  if (dueRes.error) console.error("due query error:", dueRes.error.message);
  if (paidRes.error) console.error("paid query error:", paidRes.error.message);

  type Embedded = {
    tenants?: { full_name?: string | null } | { full_name?: string | null }[] | null;
    properties?: { address?: string | null } | null;
  };

  const unwrap = <T>(rel: T | T[] | null | undefined): T | null =>
    rel == null ? null : Array.isArray(rel) ? (rel[0] ?? null) : rel;

  const merged = new Map<string, Record<string, unknown>>();

  const ingest = (rows: Record<string, unknown>[] | null) => {
    for (const r of rows ?? []) merged.set(String(r.id), r);
  };

  ingest((dueRes.data ?? []) as Record<string, unknown>[]);
  ingest((paidRes.data ?? []) as Record<string, unknown>[]);

  console.log("\n=== Command Center KPI audit ===");
  console.log("Landlord scope: tenancies.properties.user_id =", userId);
  console.log("Anchor (today UTC):", todayIso);
  console.log("Windows:", { current, nextMonth, lastMonth });

  const totals: Record<string, number> = {
    current_collected: 0,
    current_outstanding: 0,
    next_month_scheduled: 0,
    last_collected: 0,
    arrears_kpi: 0,
  };

  const rowsOut: RawRow[] = [];

  for (const row of merged.values()) {
    const tenants = unwrap((row.tenancies as Embedded | null)?.tenants as Embedded["tenants"]);
    const tname =
      tenants && typeof tenants === "object" && "full_name" in tenants
        ? String((tenants as { full_name?: string }).full_name ?? "").trim() || null
        : null;
    const tenancyId =
      unwrap(row.tenancies as { id?: string } | { id?: string }[] | null)?.id ?? null;

    const p = {
      status: row.status as string | null,
      due_date: row.due_date as string | null,
      paid_date: row.paid_date as string | null,
    };
    const amt = resolvePaymentAmount(row);

    const { buckets } = bucketsForRow(todayIso, amt, p, current, nextMonth, lastMonth);

    for (const b of buckets) {
      if (b === "current_collected") totals.current_collected += amt;
      if (b === "current_outstanding") totals.current_outstanding += amt;
      if (b === "next_month_scheduled") totals.next_month_scheduled += amt;
      if (b === "last_collected") totals.last_collected += amt;
      if (b === "arrears_kpi") totals.arrears_kpi += amt;
    }

    const addr = unwrap((row.tenancies as Embedded | null)?.properties)?.address ?? "";

    rowsOut.push({
      id: String(row.id),
      amount: row.amount,
      status: row.status as string | null,
      due_date: row.due_date as string | null,
      paid_date: row.paid_date as string | null,
      tenant_name: tname,
      tenancy_id: tenancyId ? String(tenancyId) : null,
      _property_stub: addr ? String(addr).split(",")[0]?.trim().slice(0, 48) : "",
      _buckets: buckets.filter((x) => x !== "none" && x !== "overdue_queue"),
    } as unknown as RawRow);
  }

  rowsOut.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  console.log("\n--- Rows in merged KPI set (due-range ∪ paid-range query) ---\n");

  const interest = rowsOut.filter(
    (r) =>
      (r as unknown as { _buckets: Bucket[] })._buckets?.length ||
      isPaymentOverdue(r.status, r.due_date, todayIso),
  );

  /** Print rows that contribute to any KPI bucket or appear overdue */
  for (const r of interest) {
    const bks = (r as unknown as { _buckets: Bucket[] })._buckets ?? [];
    const amt = resolvePaymentAmount(r);
    const ov = isPaymentOverdue(r.status, r.due_date, todayIso);
    console.log(JSON.stringify({
      payment_id: r.id,
      tenant: r.tenant_name,
      property_line: (r as unknown as { _property_stub: string })._property_stub,
      amount: amt,
      status: r.status,
      due_date: r.due_date?.slice?.(0, 10),
      paid_date: r.paid_date?.slice?.(0, 10),
      is_overdue_rule: ov,
      kpi_buckets: bks.filter((x) => x !== "none"),
      note:
        ov && !bks.includes("current_outstanding")
          ? "OVERDUE but due_date outside current calendar month → does not increase Outstanding(Mo)"
          : undefined,
    }));
  }

  /** Overdue queue top 5 (same order principle as dashboard: ascending due_date, then slice) */
  const overdueSorted = [...rowsOut]
    .filter((r) => isPaymentOverdue(r.status, r.due_date, todayIso))
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .slice(0, 5);

  console.log("\n--- Computed totals (matches loadCommandCenterFinancials + arrearsOutstanding) ---\n");
  console.log(
    JSON.stringify(
      {
        rentCollectedThisMonth: totals.current_collected,
        rentDueThisMonth_OutstandingMo: totals.current_outstanding,
        rentExpectedNextMonth_ScheduledNextMo: totals.next_month_scheduled,
        rentCollectedLastMonth: totals.last_collected,
        overdueRentTotal_TotalArrears: totals.arrears_kpi,
      },
      null,
      2,
    ),
  );

  console.log("\n--- Overdue queue (first 5 by due_date) ---\n");
  console.log(JSON.stringify(overdueSorted.map((r) => ({
    payment_id: r.id,
    tenant: r.tenant_name,
    amount: resolvePaymentAmount(r),
    status: r.status,
    due_date: r.due_date?.slice?.(0, 10),
    paid_date: r.paid_date?.slice?.(0, 10),
  })), null, 2));

  const sumQueue = overdueSorted.reduce((s, r) => s + resolvePaymentAmount(r), 0);
  console.log("\nSum of displayed overdue queue slice (max 5):", sumQueue);
  console.log("Sum of ALL overdue instalments:", totals.arrears_kpi);

  console.log("\n--- Interpretation ---");
  console.log(
    "- Rent Tracker “Still Due” (`outstandingThisMonth`): UNPAID rows with due_date on or before end of current month (includes carried arrears). Command Center `rentDueThisMonth` stays current calendar month only.",
  );
  console.log(
    "- Total Arrears includes ALL overdue/past-due pending rows (same rule as overdue queue filter), regardless of due month.",
  );
  console.log(
    "- Scheduled (Next Mo) sums ALL instalments (paid or unpaid) with due_date in NEXT calendar month.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
