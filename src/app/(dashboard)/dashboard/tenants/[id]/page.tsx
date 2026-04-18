export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
    <div className="@container/main relative flex flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,420px)] bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(189,153,82,0.12),transparent_65%)] dark:bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(61,26,10,0.35),transparent_65%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-8 py-8 md:py-10">
        <header className="flex flex-col gap-6 px-4 lg:flex-row lg:items-start lg:justify-between lg:px-6">
          <div className="max-w-3xl space-y-3">
            <Link
              href="/dashboard/tenants"
              className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-sm font-medium text-muted-foreground transition-colors hover:text-[#BD9952]"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Tenants
            </Link>
            <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#BD9952]/95">
              Tenant profile
            </p>
            <h1 className="font-headline text-2xl font-extralight tracking-[-0.04em] text-foreground sm:text-3xl md:text-[2.15rem] md:leading-tight">
              {tenant.fullName ?? "Tenant"}
            </h1>
            <p className="font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
              {tenant.email ?? "—"}
            </p>
          </div>
          <div className="shrink-0 lg:pt-8">
            <EditTenantDialog tenantId={tenant.id} initial={toTenantFormInput(tenant)} />
          </div>
        </header>

        <div className="grid gap-6 px-4 lg:px-6">
          <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
            <CardHeader className="border-b border-border bg-muted/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="font-headline text-lg font-light tracking-tight text-foreground">
                  Contact &amp; verification
                </CardTitle>
                {rightToRentBadge(tenant.rightToRentStatus)}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-6 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Phone
                  </span>
                  <p className="mt-1 font-[family-name:var(--font-inter)] font-medium text-foreground">{tenant.phone ?? "—"}</p>
                </div>
                <div>
                  <span className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Date of birth
                  </span>
                  <p className="mt-1 font-[family-name:var(--font-inter)] font-medium text-foreground">
                    {tenant.dateOfBirth ?? "—"}
                  </p>
                </div>
              </div>
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
                      Property
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
                  {tenant.tenancies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
                        No tenancies linked to this profile yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenant.tenancies.map((t) => (
                      <TableRow key={t.id} className="border-border/70">
                        <TableCell className="max-w-[280px] truncate font-medium text-foreground">
                          {t.propertyAddress ?? "—"}
                        </TableCell>
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
