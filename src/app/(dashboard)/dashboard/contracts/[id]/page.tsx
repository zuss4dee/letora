import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { ConfirmMoveInButton } from "./confirm-move-in-button";
import { LandlordSignButton } from "./landlord-sign-button";

function statusBadge(status: string | null) {
  const s = (status ?? "draft").toLowerCase();
  const map: Record<string, { label: string; className: string }> = {
    draft: {
      label: "Draft",
      className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300",
    },
    sent: {
      label: "Sent",
      className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-500/10 dark:text-blue-300",
    },
    pending_signature: {
      label: "Pending Signature",
      className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-500/10 dark:text-violet-300",
    },
    signed: {
      label: "Signed",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    active: {
      label: "Active",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    expired: {
      label: "Expired",
      className: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700/40 dark:bg-zinc-500/10 dark:text-zinc-400",
    },
    cancelled: {
      label: "Cancelled",
      className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300",
    },
  };
  const info = map[s] ?? { label: status ?? "Unknown", className: "border-zinc-200 bg-zinc-50 text-zinc-600" };
  return <Badge className={`border ${info.className}`}>{info.label}</Badge>;
}

function formatDate(val: string | null) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !contract) notFound();

  const [{ data: tenant }, { data: property }] = await Promise.all([
    contract.tenant_id
      ? supabase.from("tenants").select("full_name, email").eq("id", contract.tenant_id).maybeSingle()
      : Promise.resolve({ data: null as { full_name: string | null; email: string | null } | null }),
    contract.property_id
      ? supabase.from("properties").select("address, city").eq("id", contract.property_id).maybeSingle()
      : Promise.resolve({ data: null as { address: string | null; city: string | null } | null }),
  ]);

  const tenantName = tenant?.full_name?.trim() || "—";
  const propertyAddr = [property?.address, property?.city].filter(Boolean).join(", ") || "—";
  const status = contract.status as string;
  const tenantSigned = Boolean(contract.tenant_signed_at);
  const landlordSigned = Boolean(contract.landlord_signed_at);
  const canLandlordSign = !landlordSigned && ["sent", "pending_signature"].includes(status);

  return (
    <div className="@container/main relative flex flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,420px)] bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(255,255,255,0.04),transparent_65%)] dark:bg-[radial-gradient(ellipse_75%_65%_at_50%_-10%,rgba(255,255,255,0.04),transparent_65%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-8 py-8 md:py-10">
        <header className="flex flex-col gap-4 px-4 lg:flex-row lg:items-start lg:justify-between lg:px-6">
          <div className="max-w-3xl space-y-3">
            <Link
              href="/dashboard/contracts"
              className="inline-flex items-center gap-2 font-[family-name:var(--font-inter)] text-sm font-medium text-muted-foreground transition-colors hover:text-zinc-300"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Contracts
            </Link>
            <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Tenancy agreement
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-headline text-3xl font-extralight tracking-[-0.04em] text-foreground md:text-[2.15rem] md:leading-tight">
                Contract
              </h1>
              {statusBadge(status)}
            </div>
            <p className="font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
              {tenantName} · {propertyAddr}
            </p>
          </div>
        </header>

        <div className="grid gap-4 px-4 md:grid-cols-2 lg:px-6">
          <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
            <CardHeader className="border-b border-border bg-muted/30 pb-3">
              <CardTitle className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Tenant
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="font-headline text-lg font-light text-foreground">{tenantName}</p>
              <p className="mt-1 font-[family-name:var(--font-inter)] text-sm text-muted-foreground">{tenant?.email ?? "—"}</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
            <CardHeader className="border-b border-border bg-muted/30 pb-3">
              <CardTitle className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Property
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="font-headline text-lg font-light text-foreground">{propertyAddr}</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
            <CardHeader className="border-b border-border bg-muted/30 pb-3">
              <CardTitle className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Period
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="font-[family-name:var(--font-inter)] text-base font-medium text-foreground">
                {formatDate(contract.start_date as string | null)} to {formatDate(contract.end_date as string | null)}
              </p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
            <CardHeader className="border-b border-border bg-muted/30 pb-3">
              <CardTitle className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Rent / deposit
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="font-[family-name:var(--font-inter)] text-base font-medium text-foreground">
                £{Number(contract.monthly_rent ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })} / month
              </p>
              <p className="mt-1 font-[family-name:var(--font-inter)] text-sm text-muted-foreground">
                Deposit: £{Number(contract.deposit_amount ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        {contract.special_clauses && (
          <div className="px-4 lg:px-6">
            <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
              <CardHeader className="border-b border-border bg-muted/30">
                <CardTitle className="font-headline text-lg font-light tracking-tight text-foreground">
                  Contract terms
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-foreground">
                  {contract.special_clauses as string}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="px-4 lg:px-6">
          <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="font-headline text-lg font-light tracking-tight text-foreground">Signatures</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tenantSigned ? "bg-emerald-500/10" : "bg-muted"}`}>
                    {tenantSigned ? (
                      <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Tenant</p>
                    <p className="text-xs text-muted-foreground">
                      {tenantSigned
                        ? `Signed on ${formatDate(contract.tenant_signed_at as string)}`
                        : "Not yet signed"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${landlordSigned ? "bg-emerald-500/10" : "bg-muted"}`}>
                    {landlordSigned ? (
                      <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Landlord (You)</p>
                    <p className="text-xs text-muted-foreground">
                      {landlordSigned
                        ? `Signed on ${formatDate(contract.landlord_signed_at as string)}`
                        : "Not yet signed"}
                    </p>
                  </div>
                </div>
              </div>

              {canLandlordSign && (
                <div className="mt-6">
                  <LandlordSignButton contractId={contract.id as string} tenantSigned={tenantSigned} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {status !== "active" && status !== "expired" && status !== "cancelled" && (
          <div className="px-4 lg:px-6">
            <Card className="overflow-hidden border-border bg-card shadow-sm ring-1 ring-border/60">
              <CardHeader className="border-b border-border bg-muted/30">
                <CardTitle className="font-headline text-lg font-light tracking-tight text-foreground">Move-in</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="mb-4 font-[family-name:var(--font-inter)] text-sm leading-relaxed text-muted-foreground">
                  {status === "signed"
                    ? "Both parties have signed. Confirm move-in to set this contract and tenancy to active."
                    : "Once both parties have signed the contract, you can confirm the tenant's move-in here."}
                </p>
                <ConfirmMoveInButton contractId={contract.id as string} status={status} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
