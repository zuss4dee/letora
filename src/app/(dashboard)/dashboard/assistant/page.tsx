import { redirect } from "next/navigation";

/** Assistant UI lives on `/dashboard` with `?c=` / `?q=`; keep route for bookmarks. */
export default async function AssistantRouteRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const key of ["c", "q", "start"]) {
    const v = sp[key];
    if (typeof v === "string" && v.length > 0) q.set(key, v);
  }
  const s = q.toString();
  redirect(s ? `/dashboard?${s}` : "/dashboard");
}
