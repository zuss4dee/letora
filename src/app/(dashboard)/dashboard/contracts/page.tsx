/**
 * Supabase migration (contracts table)
 *
 * ```sql
 * create table if not exists public.contracts (
 *   id uuid primary key,
 *   user_id uuid references auth.users (id),
 *   tenant_id uuid references public.tenant_profiles (id),
 *   property_id uuid references public.properties (id),
 *   contract_type text not null,
 *   start_date date not null,
 *   end_date date not null,
 *   monthly_rent numeric not null,
 *   deposit_amount numeric not null,
 *   special_clauses text,
 *   status text not null default 'draft',
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 *
 * alter table public.contracts enable row level security;
 *
 * create policy "contracts_select_own"
 * on public.contracts for select
 * using (user_id = auth.uid());
 *
 * create policy "contracts_insert_own"
 * on public.contracts for insert
 * with check (user_id = auth.uid());
 *
 * create policy "contracts_update_own"
 * on public.contracts for update
 * using (user_id = auth.uid())
 * with check (user_id = auth.uid());
 *
 * create policy "contracts_delete_own"
 * on public.contracts for delete
 * using (user_id = auth.uid());
 * ```
 */

import Link from "next/link";

import { AppSidebar } from "@/components/app-sidebar";
import { NewContractDialog } from "@/components/contracts/new-contract-dialog";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getContracts } from "@/lib/actions/contracts";
import { getProperties } from "@/lib/actions/properties";
import { getTenants } from "@/lib/actions/tenants";
import { createClient } from "@/lib/supabase/server";

type ContractStatus = "draft" | "sent" | "signed" | "expired";

function statusBadge(status: string | null) {
  const s = (status ?? "draft").toLowerCase() as ContractStatus;
  if (s === "sent") {
    return (
      <Badge className="border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-500/10 dark:text-blue-300">
        Sent
      </Badge>
    );
  }
  if (s === "signed") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Signed
      </Badge>
    );
  }
  if (s === "expired") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        Expired
      </Badge>
    );
  }
  return (
    <Badge className="border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
      Draft
    </Badge>
  );
}

export default async function ContractsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  const [contracts, tenants, properties] = userId
    ? await Promise.all([
        getContracts(userId),
        getTenants(userId),
        getProperties(userId),
      ])
    : [{ active: [], drafts: [] }, [], []];

  const tenantOptions = tenants.map((tenant) => ({
    id: tenant.id,
    label: `${tenant.fullName ?? "Tenant"}${tenant.email ? ` (${tenant.email})` : ""}`,
  }));

  const propertyOptions = properties.map((property) => ({
    id: property.id,
    label: `${property.address ?? "Property"}${property.city ? `, ${property.city}` : ""}`,
  }));

  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" userEmail={userEmail} />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
                  <div>
                    <h1 className="text-base font-semibold tracking-tight">Contracts</h1>
                    <p className="text-sm text-muted-foreground">
                      Draft, send and manage tenancy agreements.
                    </p>
                  </div>
                  <NewContractDialog tenants={tenantOptions} properties={propertyOptions} />
                </div>

                <div className="grid gap-4 px-4 lg:px-6">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>Active Contracts</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Tenant</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contracts.active.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No active contracts yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            contracts.active.map((contract) => (
                              <TableRow key={contract.id}>
                                <TableCell className="font-medium">
                                  {contract.tenantFullName ?? "—"}
                                </TableCell>
                                <TableCell>{contract.propertyAddress ?? "—"}</TableCell>
                                <TableCell>{contract.contractType ?? "—"}</TableCell>
                                <TableCell>{contract.startDate ?? "—"}</TableCell>
                                <TableCell>{contract.endDate ?? "—"}</TableCell>
                                <TableCell>{statusBadge(contract.status)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button asChild variant="outline" size="sm">
                                      <Link href={`/dashboard/contracts/${contract.id}`}>View</Link>
                                    </Button>
                                    <Button asChild variant="outline" size="sm">
                                      <Link href={`/dashboard/contracts/${contract.id}/download`}>
                                        Download
                                      </Link>
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>Draft Contracts</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Tenant</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contracts.drafts.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No draft contracts yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            contracts.drafts.map((contract) => (
                              <TableRow key={contract.id}>
                                <TableCell className="font-medium">
                                  {contract.tenantFullName ?? "—"}
                                </TableCell>
                                <TableCell>{contract.propertyAddress ?? "—"}</TableCell>
                                <TableCell>{contract.contractType ?? "—"}</TableCell>
                                <TableCell>{contract.startDate ?? "—"}</TableCell>
                                <TableCell>{contract.endDate ?? "—"}</TableCell>
                                <TableCell>{statusBadge(contract.status)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button asChild variant="outline" size="sm">
                                      <Link href={`/dashboard/contracts/${contract.id}`}>View</Link>
                                    </Button>
                                    <Button asChild variant="outline" size="sm">
                                      <Link href={`/dashboard/contracts/${contract.id}/download`}>
                                        Download
                                      </Link>
                                    </Button>
                                    <Button asChild variant="outline" size="sm">
                                      <Link href={`/dashboard/contracts/${contract.id}/edit`}>Edit</Link>
                                    </Button>
                                  </div>
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
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

