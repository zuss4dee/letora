export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BedDouble } from "lucide-react";

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
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/dashboard/properties" className="text-sm text-muted-foreground hover:text-foreground">
              ← Properties
            </Link>
            <h1 className="mt-2 text-base font-semibold tracking-tight">
              {property.address ?? "Property"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[property.city, property.postcode].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <EditPropertyDialog propertyId={property.id} initial={toPropertyFormInput(property)} />
        </div>

        <div className="grid gap-4 px-4 lg:px-6">
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="text-sm font-medium">Details</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {propertyTypeBadge(property.propertyType)}
                  {statusBadge(property.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <BedDouble className="h-4 w-4" />
                  <span>{property.bedrooms ?? "—"} bed</span>
                </div>
                <div className="flex items-center gap-1">
                  <Bath className="h-4 w-4" />
                  <span>{property.bathrooms ?? "—"} bath</span>
                </div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {property.monthlyRent == null ? "—" : gbp.format(property.monthlyRent)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/mo</span>
                </div>
              </div>
              {property.marketingDescription ? (
                <div className="mt-4 border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Marketing description
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {property.marketingDescription}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-sm font-medium">Tenancies</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Tenant</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenancies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No tenancies for this property yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenancies.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.tenantName ?? "—"}</TableCell>
                        <TableCell>{t.startDate ?? "—"}</TableCell>
                        <TableCell>{t.status ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/dashboard/tenancies/${t.id}`}
                            className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
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
