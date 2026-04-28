export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

/** Home workspace is `/dashboard` (single shell). */
export default function DashboardHomeLegacyRedirect() {
  redirect("/dashboard");
}
