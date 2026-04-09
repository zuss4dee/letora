import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { SignContractForm } from "./sign-contract-form";

type ContractForSigning = {
  id: string;
  status: string;
  special_clauses: string | null;
  tenant_signed_at: string | null;
  tenantName: string;
  propertyAddress: string;
  startDate: string | null;
  endDate: string | null;
  monthlyRent: number;
  depositAmount: number;
};

export default async function SignContractPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token?.trim()) notFound();

  const supabase = createServiceRoleClient();

  const { data: contract, error } = await supabase
    .from("contracts")
    .select(
      "id, status, special_clauses, tenant_signed_at, tenant_id, property_id, start_date, end_date, monthly_rent, deposit_amount",
    )
    .eq("signing_token", token)
    .single();

  if (error || !contract) notFound();

  const [{ data: tenant }, { data: property }] = await Promise.all([
    supabase
      .from("tenants")
      .select("full_name")
      .eq("id", contract.tenant_id)
      .single(),
    supabase
      .from("properties")
      .select("address, city")
      .eq("id", contract.property_id)
      .single(),
  ]);

  const data: ContractForSigning = {
    id: contract.id as string,
    status: contract.status as string,
    special_clauses: contract.special_clauses as string | null,
    tenant_signed_at: contract.tenant_signed_at as string | null,
    tenantName: tenant?.full_name?.trim() || "Tenant",
    propertyAddress: [property?.address, property?.city].filter(Boolean).join(", ") || "Property",
    startDate: (contract.start_date as string | null) ?? null,
    endDate: (contract.end_date as string | null) ?? null,
    monthlyRent: Number(contract.monthly_rent ?? 0),
    depositAmount: Number(contract.deposit_amount ?? 0),
  };

  if (data.tenant_signed_at) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground dark:bg-[#0d0c0b]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(189,153,82,0.15),transparent_60%)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(61,26,10,0.4),transparent_60%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-lg ring-1 ring-border/60 backdrop-blur-md dark:border-transparent dark:bg-gradient-to-b dark:from-[#1c1b1a]/95 dark:to-[#141312]/98 dark:shadow-[0_24px_48px_rgba(0,0,0,0.45)] dark:ring-[rgb(72_72_72_/0.08)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#BD9952]/12 ring-1 ring-[#BD9952]/25">
            <svg
              className="h-7 w-7 text-[#BD9952]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="font-headline text-xl font-light tracking-tight text-foreground">Already signed</h1>
          <p className="mt-3 font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-muted-foreground">
            You have already signed this tenancy agreement. Your landlord has been notified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground dark:bg-[#0d0c0b]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_45%_at_50%_-15%,rgba(189,153,82,0.12),transparent_58%)] dark:bg-[radial-gradient(ellipse_90%_45%_at_50%_-15%,rgba(61,26,10,0.35),transparent_58%)]"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl ring-1 ring-border/60 backdrop-blur-md dark:border-transparent dark:bg-gradient-to-b dark:from-[#1c1b1a]/95 dark:to-[#141312]/98 dark:shadow-[0_28px_90px_-48px_rgba(0,0,0,0.85)] dark:ring-[rgb(72_72_72_/0.08)]">
        <div className="border-b border-border bg-muted/40 px-6 py-6 dark:border-[rgb(72_72_72_/0.08)] dark:bg-[#1a1918]/40 sm:px-8">
          <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#BD9952]/90">
            Tenancy agreement
          </p>
          <h1 className="mt-2 font-headline text-xl font-light tracking-tight text-foreground">Review &amp; sign</h1>
          <p className="mt-2 font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
            For <span className="font-medium text-foreground">{data.tenantName}</span> at{" "}
            <span className="font-medium text-foreground">{data.propertyAddress}</span>
          </p>
        </div>

        <div className="space-y-4 px-6 py-6 sm:px-8">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Start date
              </span>
              <p className="mt-1 font-[family-name:var(--font-inter)] text-sm font-medium text-foreground">
                {data.startDate ?? "—"}
              </p>
            </div>
            <div>
              <span className="font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                End date
              </span>
              <p className="mt-1 font-[family-name:var(--font-inter)] text-sm font-medium text-foreground">
                {data.endDate ?? "—"}
              </p>
            </div>
            <div>
              <span className="font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Monthly rent
              </span>
              <p className="mt-1 font-[family-name:var(--font-inter)] text-sm font-medium text-foreground">
                £{data.monthlyRent.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span className="font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Deposit
              </span>
              <p className="mt-1 font-[family-name:var(--font-inter)] text-sm font-medium text-foreground">
                £{data.depositAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {data.special_clauses && (
            <div className="rounded-xl border border-border bg-muted/50 p-4 ring-1 ring-border/60 dark:border-transparent dark:bg-[#0e0e0e]/45 dark:ring-[rgb(72_72_72_/0.1)]">
              <h2 className="mb-2 font-headline text-sm font-light text-foreground">Contract terms</h2>
              <div className="prose prose-sm max-h-96 overflow-y-auto whitespace-pre-wrap font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground dark:prose-invert">
                {data.special_clauses}
              </div>
            </div>
          )}
        </div>

        <SignContractForm token={token} />
      </div>
    </div>
  );
}
