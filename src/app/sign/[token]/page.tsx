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
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="mx-auto w-full max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
            <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Already Signed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You have already signed this tenancy agreement. Your landlord has been notified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-card shadow-lg">
        <div className="border-b border-border px-6 py-5">
          <h1 className="text-lg font-semibold text-foreground">Tenancy Agreement</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            For <span className="font-medium text-foreground">{data.tenantName}</span> at{" "}
            <span className="font-medium text-foreground">{data.propertyAddress}</span>
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Start date</span>
              <p className="font-medium text-foreground">{data.startDate ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">End date</span>
              <p className="font-medium text-foreground">{data.endDate ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Monthly rent</span>
              <p className="font-medium text-foreground">
                £{data.monthlyRent.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Deposit</span>
              <p className="font-medium text-foreground">
                £{data.depositAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {data.special_clauses && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Contract Terms</h2>
              <div className="prose prose-sm dark:prose-invert max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
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
