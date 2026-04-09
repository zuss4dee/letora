export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bath, BedDouble } from "lucide-react";

import { EditPropertyDialog } from "@/components/properties/edit-property-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPropertyById, getTenanciesForProperty, type PropertyRow } from "@/lib/actions/properties";
import { type AddPropertyInput } from "@/lib/validations/property";
import { createClient } from "@/lib/supabase/server";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function propertyTypeBadge(type: string | null) {
  if (!type) return null;
  return (
    <Badge variant="outline" className="text-xs">
      {type}
    </Badge>
  );
}

function statusBadge(status: string | null) {
  const s = status ?? "active";
  if (s === "active") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Active
      </Badge>
    );
  }
  if (s === "vacant") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
        Vacant
      </Badge>
    );
  }
  return (
    <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
      Maintenance
    </Badge>
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

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
    <div className="@container/main relative flex flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,420px)] bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(189,153,82,0.12),transparent_65%)] dark:bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(61,26,10,0.35),transparent_65%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-8 py-8 md:py-10">
        <header className="flex flex-col gap-6 px-4 lg:flex-row lg:items-start lg:justify-between lg:px-6">
          <div className="max-w-3xl space-y-3">
            <Link
              href="/dashboard/properties"
              className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-sm font-medium text-muted-foreground transition-colors hover:text-[#BD9952]"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Managed properties
            </Link>
            <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#BD9952]/95">
              Property
            </p>
            <h1 className="font-headline text-3xl font-extralight tracking-[-0.04em] text-foreground md:text-[2.15rem] md:leading-tight">
              {property.address ?? "Property"}
            </h1>
            <p className="font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
              {[property.city, property.postcode].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="shrink-0 lg:pt-8">
            <EditPropertyDialog propertyId={property.id} initial={toPropertyFormInput(property)} />
          </div>
        </header>

        <div className="grid gap-6 px-4 lg:px-6">
          <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
            <CardHeader className="border-b border-border bg-muted/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="font-headline text-lg font-light tracking-tight text-foreground">
                  Details
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {propertyTypeBadge(property.propertyType)}
                  {statusBadge(property.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4 text-[#BD9952]" />
                  <span>{property.bedrooms ?? "—"} bed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Bath className="h-4 w-4 text-[#BD9952]" />
                  <span>{property.bathrooms ?? "—"} bath</span>
                </div>
                <div className="font-[family-name:var(--font-inter)] font-medium text-foreground">
                  {property.monthlyRent == null ? "—" : gbp.format(property.monthlyRent)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/mo</span>
                </div>
              </div>
              {property.marketingDescription ? (
                <div className="mt-6 border-t border-border pt-6">
                  <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Marketing description
                  </p>
                  <p className="mt-2 whitespace-pre-wrap font-[family-name:var(--font-inter)] text-sm leading-relaxed text-foreground">
                    {property.marketingDescription}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="font-headline text-lg font-light tracking-tight text-foreground">
                Tenancies
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-wider">
                      Tenant
                    </TableHead>
                    <TableHead className="font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-wider">
                      Start
                    </TableHead>
                    <TableHead className="font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="text-right font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-wider">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenancies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
                        No tenancies for this property yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenancies.map((t) => (
                      <TableRow key={t.id} className="border-border/70">
                        <TableCell className="font-medium text-foreground">{t.tenantName ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{t.startDate ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{t.status ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/dashboard/tenancies/${t.id}`}
                            className="font-[family-name:var(--font-inter)] text-sm font-medium text-[#BD9952] underline-offset-4 hover:underline"
                          >
                            View
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
