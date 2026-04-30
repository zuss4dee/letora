import { createClient } from "@/lib/supabase/server";

/**
 * Checks if a payment is overdue based on its status and due date.
 * Consistent with Rent Tracker and Dashboard logic.
 */
export function isPaymentOverdue(
  status: string | null,
  dueDate: string | null,
  todayIso: string
): boolean {
  const st = (status ?? "").toLowerCase();
  return st === "overdue" || (st === "pending" && dueDate != null && dueDate < todayIso);
}

/**
 * Resolves the amount for a rent payment row, checking both 'amount' and 'amount_due' columns.
 * Standardizes the fragmented schema.
 */
export function resolvePaymentAmount(row: { amount?: number | null; amount_due?: number | null }): number {
  const amt = row.amount ?? row.amount_due ?? 0;
  return typeof amt === "number" ? amt : Number(amt || 0);
}

/**
 * Shared server-side utility to calculate the total outstanding (overdue) rent for a user.
 * Acts as the single source of truth for "Amount Due" KPIs.
 */
export async function getOutstandingRentTotal(userId: string): Promise<number> {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  // We fetch all non-paid payments. 
  // We check both status='overdue' and status='pending' with past due_date.
  const { data, error } = await supabase
    .from("rent_payments")
    .select("amount, amount_due, status, due_date")
    .eq("user_id", userId)
    .neq("status", "paid");

  if (error || !data) return 0;

  return data.reduce((sum, row) => {
    if (isPaymentOverdue(row.status, row.due_date, todayIso)) {
      return sum + resolvePaymentAmount(row);
    }
    return sum;
  }, 0);
}
