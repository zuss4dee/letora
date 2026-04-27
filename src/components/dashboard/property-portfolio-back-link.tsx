import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getPropertyById } from "@/lib/actions/properties";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

function portfolioPropertyLabel(property: { address: string | null; city: string | null }): string {
  const first = property.address?.split(",")[0]?.trim();
  if (first) return first;
  if (property.city) return property.city;
  return "property";
}

export async function PropertyPortfolioBackLink({
  propertyId,
  className,
}: {
  propertyId: string;
  className?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  if (!userId) return null;

  const property = await getPropertyById(userId, propertyId);
  const href = `/dashboard/properties?propertyId=${encodeURIComponent(propertyId)}`;
  const label = property ? portfolioPropertyLabel(property) : null;
  const text = label ? `Back to ${label}` : "Back to properties";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 transition-colors hover:text-[#BD9952] dark:text-zinc-400 dark:hover:text-[#BD9952]",
        className,
      )}
    >
      <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
      {text}
    </Link>
  );
}
