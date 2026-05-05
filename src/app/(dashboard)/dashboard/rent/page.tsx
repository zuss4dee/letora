export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

/**
 * Legacy path: HTTP redirect is also declared in `next.config.ts`.
 * This module keeps behaviour obvious in the app router and avoids maintaining a second rent UI.
 */
export default function RentLegacyRedirect() {
  redirect("/dashboard/rent-tracker");
}
