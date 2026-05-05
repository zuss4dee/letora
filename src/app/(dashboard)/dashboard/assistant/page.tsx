export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

/**
 * Legacy `/dashboard/assistant` → canonical Command Center chat at `/dashboard?c=`.
 * Preserves all query params (`c`, `q`, `start`, etc.) for deep links and bookmarks.
 */
export default async function AssistantLegacyRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp)) {
    if (raw === undefined) continue;
    if (Array.isArray(raw)) {
      for (const v of raw) q.append(key, v);
    } else {
      q.set(key, raw);
    }
  }
  const qs = q.toString();
  redirect(qs ? `/dashboard?${qs}` : "/dashboard");
}
