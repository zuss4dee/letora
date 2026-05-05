import { createClient } from "@/lib/supabase/server";

import { isPaymentOverdue, resolvePaymentAmount } from "@/lib/rent-payment-helpers";

export { isPaymentOverdue, resolvePaymentAmount } from "@/lib/rent-payment-helpers";

/**
 * Shared server-side utility to calculate the total outstanding (overdue) rent for a user.
 * Acts as the single source of truth for "Amount Due" KPIs.
 */
export async function getOutstandingRentTotal(userId: string): Promise<number> {
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  // We fetch all non-paid payments.
  // We scope through tenancies -> properties to ensure consistent ownership check.
  /** Match `getDashboardStats` ownership filter; do NOT use `.neq("status","paid")` here — in SQL it drops `NULL`/edge statuses and diverges from `isPaymentOverdue` logic applied everywhere else. */
  const { data, error } = await supabase
    .from("rent_payments")
    .select("amount, status, due_date, tenancies!inner(properties!inner(user_id))")
    .eq("tenancies.properties.user_id", userId);

  if (error) {
    console.warn("[getOutstandingRentTotal]", error.message);
    return 0;
  }
  if (!data) return 0;

  return data.reduce((sum, row) => {
    if (isPaymentOverdue(row.status, row.due_date, todayIso)) {
      return sum + resolvePaymentAmount(row);
    }
    return sum;
  }, 0);
}
