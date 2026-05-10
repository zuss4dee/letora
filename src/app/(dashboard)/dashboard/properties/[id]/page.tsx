export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bath, BedDouble } from "lucide-react";

import { BatchReviewReturnBanner } from "@/components/dashboard/batch-review-return-banner";
import { EditPropertyDialog } from "@/components/properties/edit-property-dialog";
import { getPropertyById, getTenanciesForProperty, type PropertyRow } from "@/lib/actions/properties";
import { parseSafeBatchReviewReturnFromSearchParams } from "@/lib/navigation/batch-review-return";
import { type AddPropertyInput } from "@/lib/validations/property";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function propertyTypeBadge(type: string | null) {
  if (!type) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[2px] border px-1.5 font-[family-name:var(--font-inter)] text-[9px] font-bold uppercase tracking-[0.08em]",
        "border-zinc-300/45 bg-zinc-100 text-zinc-800 dark:border-zinc-500/30 dark:bg-zinc-800/60 dark:text-zinc-200",
      )}
    >
      {type}
    </span>
  );
}

function statusBadge(status: string | null) {
  const s = status ?? "active";
  if (s === "active") {
    return (
      <span
        className={cn(
          "inline-flex h-5 items-center rounded-[2px] border px-1.5 font-[family-name:var(--font-inter)] text-[9px] font-bold uppercase tracking-[0.08em]",
          "border-emerald-300/45 bg-emerald-100 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200",
        )}
      >
        Active
      </span>
    );
  }
  if (s === "vacant") {
    return (
      <span
        className={cn(
          "inline-flex h-5 items-center rounded-[2px] border px-1.5 font-[family-name:var(--font-inter)] text-[9px] font-bold uppercase tracking-[0.08em]",
          "border-amber-300/40 bg-amber-100 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200",
        )}
      >
        Vacant
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[2px] border px-1.5 font-[family-name:var(--font-inter)] text-[9px] font-bold uppercase tracking-[0.08em]",
        "border-red-300/45 bg-red-100 text-red-800 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-200",
      )}
    >
      Maintenance
    </span>
  );
}

function toPropertyFormInput(p: PropertyRow): AddPropertyInput {
  const types = ["Flat", "House", "Semi-detached", "Terraced"] as const;
  const statuses = ["active", "vacant", "maintenance"] as const;
  const pt = types.includes(p.propertyType as (typeof types)[number])
    ? (p.propertyType as AddPropertyInput["propertyType"])
    : "Flat";
  const st = statuses.includes(p.status as (typeof statuses)[number])
    ? (p.status as AddPropertyInput["status"])
    : "active";
  return {
    address: p.address ?? "",
    postcode: p.postcode ?? "",
    city: p.city ?? "",
    propertyType: pt,
    bedrooms: p.bedrooms ?? 1,
    bathrooms: p.bathrooms ?? 1,
    monthlyRent: p.monthlyRent ?? 0,
    status: st,
    hasGasSupply: p.hasGasSupply ?? true,
    epcExpiry: undefined,
    eicrExpiry: undefined,
    gasSafetyExpiry: undefined,
  };
}

function PropertyDetailSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-4 border-b border-zinc-200/70 bg-zinc-100 px-4 py-5 dark:border-zinc-800 dark:bg-[#161616] md:flex-row md:items-start md:justify-between md:px-6">
        <div className="max-w-2xl flex-1 space-y-3">
          <div className="h-3 w-28 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
          <div className="h-2.5 w-20 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
          <div className="h-7 w-64 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
          <div className="h-3 w-48 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
        </div>
        <div className="h-8 w-28 shrink-0 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80 md:mt-2" />
      </div>
      <div className="flex flex-1 flex-col gap-px bg-zinc-200/70 dark:bg-zinc-800">
        <div className="bg-background dark:bg-[#f8f8f7] p-4 dark:bg-[#1A1A1A] md:p-6">
          <div className="mb-4 flex justify-between gap-3">
            <div className="h-3 w-24 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
            <div className="h-5 w-20 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="h-4 w-16 animate-pulse rounded-[2px] bg-zinc-200/80 dark:bg-zinc-800/60" />
            <div className="h-4 w-16 animate-pulse rounded-[2px] bg-zinc-200/80 dark:bg-zinc-800/60" />
            <div className="h-4 w-24 animate-pulse rounded-[2px] bg-zinc-200/80 dark:bg-zinc-800/60" />
          </div>
        </div>
        <div className="min-h-[200px] flex-1 bg-background dark:bg-[#f8f8f7] dark:bg-[#1A1A1A]">
          <div className="space-y-2 p-4 md:p-6">
            <div className="h-3 w-24 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-[2px] bg-zinc-200/80 dark:bg-zinc-800/50"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

async function PropertyDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  if (!userId) {
    return notFound();
  }

  const property = await getPropertyById(userId, id);
  if (!property) {
    return notFound();
  }

  const tenancies = await getTenanciesForProperty(userId, id);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(38vh,360px)] bg-[radial-gradient(ellipse_70%_60%_at_50%_-8%,rgba(255,255,255,0.04),transparent_62%)] dark:bg-[radial-gradient(ellipse_70%_60%_at_50%_-8%,rgba(255,255,255,0.04),transparent_62%)]"
        aria-hidden
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="flex flex-col gap-4 border-b border-zinc-200/70 bg-zinc-100 px-4 py-5 dark:border-zinc-800 dark:bg-[#161616] md:flex-row md:items-start md:justify-between md:px-6">
          <div className="max-w-3xl space-y-3">
            <Link
              href={`/dashboard/properties?propertyId=${encodeURIComponent(property.id)}`}
              className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 transition-colors hover:text-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
              Managed properties
            </Link>
            <p className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Property
            </p>
            <h1 className="font-headline text-[22px] font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white sm:text-[24px]">
              {property.address ?? "Property"}
            </h1>
            <p className="font-[family-name:var(--font-inter)] text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {[property.city, property.postcode].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="shrink-0 md:pt-1">
            <EditPropertyDialog propertyId={property.id} initial={toPropertyFormInput(property)} />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-px bg-zinc-200/70 dark:bg-zinc-800">
          <section className="bg-background dark:bg-[#f8f8f7] dark:bg-[#1A1A1A]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800 md:px-6">
              <h2 className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                Details
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {propertyTypeBadge(property.propertyType)}
                {statusBadge(property.status)}
              </div>
            </div>
            <div className="px-4 py-5 md:px-6 md:py-6">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-1.5 font-[family-name:var(--font-inter)] text-[13px] text-zinc-600 dark:text-zinc-400">
                  <BedDouble className="size-4 shrink-0 text-zinc-500" aria-hidden />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {property.bedrooms ?? "—"} bed
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-[family-name:var(--font-inter)] text-[13px] text-zinc-600 dark:text-zinc-400">
                  <Bath className="size-4 shrink-0 text-zinc-500" aria-hidden />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {property.bathrooms ?? "—"} bath
                  </span>
                </div>
                <div className="font-[family-name:var(--font-inter)] text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                  {property.monthlyRent == null ? "—" : gbp.format(property.monthlyRent)}
                  <span className="ml-1 text-[11px] font-normal text-zinc-500 dark:text-zinc-500">
                    /mo
                  </span>
                </div>
              </div>
              {property.marketingDescription ? (
                <div className="mt-6 border-t border-zinc-200/70 pt-6 dark:border-zinc-800">
                  <p className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    Marketing description
                  </p>
                  <p className="mt-2 whitespace-pre-wrap font-[family-name:var(--font-inter)] text-[13px] leading-relaxed text-zinc-900 dark:text-zinc-100">
                    {property.marketingDescription}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col bg-background dark:bg-[#f8f8f7] dark:bg-[#1A1A1A]">
            <div className="border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800 md:px-6">
              <h2 className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                Tenancies
              </h2>
            </div>

            {tenancies.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                <p className="max-w-sm font-[family-name:var(--font-inter)] text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                  No tenancies for this property yet.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-zinc-100 dark:bg-[#131313]">
                    <tr className="border-b border-zinc-200/70 dark:border-zinc-800">
                      <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                        Tenant
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                        Start
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenancies.map((t, idx) => (
                      <tr
                        key={t.id}
                        className={cn(
                          "h-10 border-b border-zinc-200/60 transition-colors hover:bg-zinc-100/80 dark:border-zinc-800 dark:hover:bg-zinc-200 dark:bg-zinc-800/35",
                          idx === 0 && "bg-zinc-100/50 dark:bg-zinc-800/25",
                        )}
                      >
                        <td className="max-w-[min(280px,40vw)] truncate px-4 py-0 font-[family-name:var(--font-inter)] text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                          {t.tenantName ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-0 font-[family-name:var(--font-inter)] text-[12px] text-zinc-600 dark:text-zinc-400">
                          {t.startDate ?? "—"}
                        </td>
                        <td className="px-4 py-0 font-[family-name:var(--font-inter)] text-[12px] text-zinc-600 dark:text-zinc-400">
                          {t.status ?? "—"}
                        </td>
                        <td className="px-4 py-0 text-right">
                          <Link
                            href={`/dashboard/tenancies/${t.id}`}
                            className="inline-flex font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground underline-offset-4 hover:text-zinc-400 hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const batchReviewReturnHref = parseSafeBatchReviewReturnFromSearchParams(sp);

  return (
    <div className="@container/main relative flex min-h-[calc(100vh-2.5rem)] flex-1 flex-col bg-background dark:bg-[#f8f8f7] text-zinc-950 dark:bg-[#0B0B0B] dark:text-zinc-100">
      {batchReviewReturnHref ? <BatchReviewReturnBanner href={batchReviewReturnHref} /> : null}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-y border-zinc-200/70 bg-white dark:border-zinc-800 dark:bg-[#1A1A1A]">
        <Suspense fallback={<PropertyDetailSkeleton />}>
          <PropertyDetailContent params={params} />
        </Suspense>
      </section>
    </div>
  );
}
