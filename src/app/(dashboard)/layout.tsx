import type { ReactNode } from "react";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  /**
   * TEMP DEBUG: auth gate removed to isolate route hangs.
   *
   * Previous blocking logic:
   * - createClient()
   * - supabase.auth.getUser()
   * - redirect("/login") when no user
   */

  return children;
}
