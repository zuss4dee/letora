export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EditTenantDialog } from "@/components/tenants/edit-tenant-dialog";
import { getTenantById } from "@/lib/actions/tenants";
import { type UpdateTenantInput } from "@/lib/validations/tenant";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

function rightToRentBadge(status: string | null) {
  const s = (status ?? "pending").toLowerCase();
  if (s === "verified") {
    return (
      <span
        className={cn(
          "inline-flex h-5 items-center rounded-[2px] border px-1.5 font-[family-name:var(--font-inter)] text-[9px] font-bold uppercase tracking-[0.08em]",
          "border-emerald-300/45 bg-emerald-100 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200",
        )}
      >
        Verified
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span
        className={cn(
          "inline-flex h-5 items-center rounded-[2px] border px-1.5 font-[family-name:var(--font-inter)] text-[9px] font-bold uppercase tracking-[0.08em]",
          "border-red-300/45 bg-red-100 text-red-800 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-200",
        )}
      >
        Failed
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[2px] border px-1.5 font-[family-name:var(--font-inter)] text-[9px] font-bold uppercase tracking-[0.08em]",
        "border-amber-300/40 bg-amber-100 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200",
      )}
    >
      Pending
    </span>
  );
}

function toTenantFormInput(t: {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  rightToRentStatus: string | null;
}): UpdateTenantInput {
  const r = (t.rightToRentStatus ?? "pending").toLowerCase();
  const rt =
    r === "verified" || r === "failed" || r === "pending"
      ? r
      : "pending";
  return {
    fullName: t.fullName ?? "",
    email: t.email ?? "",
    phone: t.phone ?? "",
    dateOfBirth: t.dateOfBirth ?? "",
    rightToRentStatus: rt,
  };
}

function initials(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

function TenantDetailSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-4 border-b border-zinc-200/70 bg-zinc-100 px-4 py-5 dark:border-zinc-800 dark:bg-[#161616] md:flex-row md:items-start md:justify-between md:px-6">
        <div className="max-w-2xl flex-1 space-y-3">
          <div className="h-3 w-20 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
          <div className="h-2.5 w-28 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-200/90 dark:bg-zinc-800/80" />
            <div className="space-y-2">
              <div className="h-6 w-48 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
              <div className="h-3 w-64 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
            </div>
          </div>
        </div>
        <div className="h-8 w-28 shrink-0 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80 md:mt-2" />
      </div>
      <div className="flex flex-1 flex-col gap-px bg-zinc-200/70 dark:bg-zinc-800">
        <div className="bg-[#f8f8f7] p-4 dark:bg-[#1A1A1A] md:p-6">
          <div className="mb-4 h-3 w-40 animate-pulse rounded-[2px] bg-zinc-200/90 dark:bg-zinc-800/80" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-12 animate-pulse rounded-[2px] bg-zinc-200/80 dark:bg-zinc-800/60" />
            <div className="h-12 animate-pulse rounded-[2px] bg-zinc-200/80 dark:bg-zinc-800/60" />
          </div>
        </div>
        <div className="min-h-[200px] flex-1 bg-[#f8f8f7] dark:bg-[#1A1A1A]">
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

async function TenantDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  if (!userId) {
    return notFound();
  }

  const tenant = await getTenantById(userId, id);
  if (!tenant) {
    return notFound();
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(38vh,360px)] bg-[radial-gradient(ellipse_70%_60%_at_50%_-8%,rgba(189,153,82,0.08),transparent_62%)] dark:bg-[radial-gradient(ellipse_70%_60%_at_50%_-8%,rgba(61,26,10,0.28),transparent_62%)]"
        aria-hidden
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="flex flex-col gap-4 border-b border-zinc-200/70 bg-zinc-100 px-4 py-5 dark:border-zinc-800 dark:bg-[#161616] md:flex-row md:items-start md:justify-between md:px-6">
          <div className="max-w-3xl space-y-3">
            <Link
              href="/dashboard/tenants"
              className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 transition-colors hover:text-[#BD9952] dark:text-zinc-500 dark:hover:text-[#BD9952]"
            >
              <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
              Tenants
            </Link>
            <p className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#BD9952]">
              Tenant profile
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-zinc-200 text-[12px] font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                {initials(tenant.fullName)}
              </span>
              <div className="min-w-0">
                <h1 className="font-headline text-[22px] font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white sm:text-[24px]">
                  {tenant.fullName ?? "Tenant"}
                </h1>
                <p className="mt-0.5 truncate font-[family-name:var(--font-inter)] text-[12px] text-zinc-600 dark:text-zinc-400">
                  {tenant.email ?? "—"}
                </p>
              </div>
            </div>
          </div>
          <div className="shrink-0 md:pt-1">
            <EditTenantDialog tenantId={tenant.id} initial={toTenantFormInput(tenant)} />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-px bg-zinc-200/70 dark:bg-zinc-800">
          <section className="bg-[#f8f8f7] dark:bg-[#1A1A1A]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800 md:px-6">
              <h2 className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                Contact &amp; verification
              </h2>
              {rightToRentBadge(tenant.rightToRentStatus)}
            </div>
            <div className="grid gap-6 px-4 py-5 sm:grid-cols-2 md:px-6 md:py-6">
              <div className="space-y-1.5">
                <span className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                  Phone
                </span>
                <p className="font-[family-name:var(--font-inter)] text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                  {tenant.phone ?? "—"}
                </p>
              </div>
              <div className="space-y-1.5">
                <span className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                  Date of birth
                </span>
                <p className="font-[family-name:var(--font-inter)] text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                  {tenant.dateOfBirth ?? "—"}
                </p>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col bg-[#f8f8f7] dark:bg-[#1A1A1A]">
            <div className="border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800 md:px-6">
              <h2 className="font-[family-name:var(--font-inter)] text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                Tenancies
              </h2>
            </div>

            {tenant.tenancies.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                <p className="max-w-sm font-[family-name:var(--font-inter)] text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                  No tenancies linked to this profile yet.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-zinc-100 dark:bg-[#131313]">
                    <tr className="border-b border-zinc-200/70 dark:border-zinc-800">
                      <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                        Property
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
                    {tenant.tenancies.map((t, idx) => (
                      <tr
                        key={t.id}
                        className={cn(
                          "h-10 border-b border-zinc-200/60 transition-colors hover:bg-zinc-100/80 dark:border-zinc-800 dark:hover:bg-zinc-800/35",
                          idx === 0 && "bg-zinc-100/50 dark:bg-zinc-800/25",
                        )}
                      >
                        <td className="max-w-[min(280px,40vw)] truncate px-4 py-0 font-[family-name:var(--font-inter)] text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                          {t.propertyAddress ?? "—"}
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
                            className="inline-flex font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-[0.06em] text-teal-700 underline-offset-4 hover:underline dark:text-teal-400/95"
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

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="@container/main relative flex min-h-[calc(100vh-2.5rem)] flex-1 flex-col bg-[#f8f8f7] text-zinc-950 dark:bg-[#0B0B0B] dark:text-zinc-100">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-y border-zinc-200/70 bg-[#161616] dark:border-zinc-800 dark:bg-[#1A1A1A]">
        <Suspense fallback={<TenantDetailSkeleton />}>
          <TenantDetailContent params={params} />
        </Suspense>
      </section>
    </div>
  );
}
