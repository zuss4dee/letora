import Link from "next/link";

import { AddTenantDialog } from "@/components/tenants/add-tenant-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTenants } from "@/lib/actions/tenants";
import { createClient } from "@/lib/supabase/server";

function rightToRentBadge(status: string | null) {
  const s = (status ?? "pending").toLowerCase();
  if (s === "verified") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Verified
      </Badge>
    );
  }
  if (s === "failed") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
      Pending
    </Badge>
  );
}

function statusBadge(status: string | null) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className="text-xs">
      {status}
    </Badge>
  );
}

export default async function TenantsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;

  const tenants = userId ? await getTenants(userId) : [];

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
                  <div>
                    <h1 className="text-base font-semibold tracking-tight">Tenants</h1>
                    <p className="text-sm text-muted-foreground">
                      Manage tenant profiles and verification status.
                    </p>
                  </div>
                  <AddTenantDialog />
                </div>

                <div className="px-4 lg:px-6">
                  {tenants.length === 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>No tenants yet</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Add your first tenant to get started.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <AddTenantDialog />
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader className="border-b">
                        <CardTitle>Tenant profiles</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Full Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead>Property</TableHead>
                              <TableHead>Right to Rent</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tenants.map((t) => (
                              <TableRow key={t.id}>
                                <TableCell className="font-medium">{t.fullName ?? "—"}</TableCell>
                                <TableCell>{t.email ?? "—"}</TableCell>
                                <TableCell>{t.phone ?? "—"}</TableCell>
                                <TableCell className="max-w-[260px] truncate">
                                  {t.propertyAddress ?? "—"}
                                </TableCell>
                                <TableCell>{rightToRentBadge(t.rightToRentStatus)}</TableCell>
                                <TableCell>{statusBadge(t.tenancyStatus)}</TableCell>
                                <TableCell className="text-right">
                                  <Button asChild variant="outline" size="sm">
                                    <Link href={`/dashboard/tenants/${t.id}`}>View</Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
      </div>
    </div>
  );
}

