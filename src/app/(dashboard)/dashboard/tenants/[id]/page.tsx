export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { EditTenantDialog } from "@/components/tenants/edit-tenant-dialog";
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
import { getTenantById } from "@/lib/actions/tenants";
import { type UpdateTenantInput } from "@/lib/validations/tenant";
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

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/dashboard/tenants" className="text-sm text-muted-foreground hover:text-foreground">
              ← Tenants
            </Link>
            <h1 className="mt-2 text-base font-semibold tracking-tight">{tenant.fullName ?? "Tenant"}</h1>
            <p className="text-sm text-muted-foreground">{tenant.email ?? "—"}</p>
          </div>
          <EditTenantDialog tenantId={tenant.id} initial={toTenantFormInput(tenant)} />
        </div>

        <div className="grid gap-4 px-4 lg:px-6">
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium">Contact & verification</CardTitle>
                {rightToRentBadge(tenant.rightToRentStatus)}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-sm">
              <div className="grid gap-1 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Phone</span>
                  <p className="font-medium">{tenant.phone ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date of birth</span>
                  <p className="font-medium">{tenant.dateOfBirth ?? "—"}</p>
                </div>
              </div>
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
                    <TableHead>Property</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenant.tenancies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No tenancies linked to this profile yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenant.tenancies.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="max-w-[280px] truncate font-medium">
                          {t.propertyAddress ?? "—"}
                        </TableCell>
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
