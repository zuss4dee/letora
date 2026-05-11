import { redirect } from "next/navigation";

/** Alias route from product copy: portfolio import vs properties list. */
export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string }>;
}) {
  const sp = await searchParams;
  if (sp.import === "true") {
    redirect("/dashboard/import");
  }
  redirect("/dashboard/properties");
}
