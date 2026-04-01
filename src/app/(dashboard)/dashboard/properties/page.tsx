export const dynamic = "force-dynamic";

import Link from "next/link";
import { Bath, BedDouble } from "lucide-react";

import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProperties } from "@/lib/actions/properties";
import { createClient } from "@/lib/supabase/server";

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

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default async function PropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  const properties = userId ? await getProperties(userId) : [];

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
                  <div>
                    <h1 className="text-base font-semibold tracking-tight">Properties</h1>
                    <p className="text-sm text-muted-foreground">
                      View and manage your portfolio.
                    </p>
                  </div>
                  <AddPropertyDialog />
                </div>

                <div className="px-4 lg:px-6">
                  {properties.length === 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>No properties yet</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Add your first property to get started.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <AddPropertyDialog />
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {properties.map((p) => (
                        <Card key={p.id} className="@container/card">
                          <CardHeader className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <CardTitle className="truncate text-sm">
                                  {p.address ?? "—"}
                                </CardTitle>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {p.city ?? "—"}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-2">
                                {propertyTypeBadge(p.propertyType)}
                                {statusBadge(p.status)}
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <BedDouble className="h-4 w-4" />
                                <span>{p.bedrooms ?? "—"}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Bath className="h-4 w-4" />
                                <span>{p.bathrooms ?? "—"}</span>
                              </div>
                              <div className="ml-auto font-medium text-zinc-900 dark:text-zinc-100">
                                {p.monthlyRent == null ? "£0" : gbp.format(p.monthlyRent)}
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                  /mo
                                </span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="flex items-center justify-end">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/dashboard/properties/${p.id}`}>View</Link>
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
      </div>
    </div>
  );
}

