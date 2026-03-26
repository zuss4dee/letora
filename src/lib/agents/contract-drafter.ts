import { GoogleGenerativeAI } from "@google/generative-ai";

import { createClient } from "@/lib/supabase/server";

export interface ContractDraftResult {
  contractId: string;
  tenantName: string;
  propertyAddress: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  contractText: string;
  actionId: string;
}

type ContractRow = {
  id: string;
  contract_type: string | null;
  start_date: string | null;
  end_date: string | null;
  monthly_rent: number | string | null;
  deposit_amount: number | string | null;
  special_clauses: string | null;
  tenant_profiles: { full_name: string | null } | null;
  properties: { address: string | null; city: string | null } | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

export async function runContractDrafterAgent(
  contractId: string,
  userId: string,
): Promise<ContractDraftResult> {
  const supabase = await createClient();
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_AI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "id,contract_type,start_date,end_date,monthly_rent,deposit_amount,special_clauses,tenant_profiles(full_name),properties(address,city)",
    )
    .eq("id", contractId)
    .eq("user_id", userId)
    .single<ContractRow>();

  if (!contract) throw new Error("Contract not found");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("business_name, landlord_name")
    .eq("user_id", userId)
    .single<{ business_name: string | null; landlord_name: string | null }>();

  const businessName = settings?.business_name ?? "Letora Property Management";
  const tenantName = contract.tenant_profiles?.full_name ?? "Unknown";
  const address = contract.properties?.address ?? "";
  const city = contract.properties?.city ?? "";
  const propertyAddress = city ? `${address}, ${city}` : address;
  const contractType = contract.contract_type ?? "Assured Shorthold Tenancy (AST)";
  const startDate = contract.start_date ?? "";
  const endDate = contract.end_date ?? "";
  const monthlyRent = toNumber(contract.monthly_rent);
  const depositAmount = toNumber(contract.deposit_amount);

  const prompt = `You are a UK property solicitor. Draft a complete, legally-structured Assured Shorthold Tenancy Agreement for England and Wales.

Landlord/Agent: ${businessName}
Tenant: ${tenantName}
Property: ${propertyAddress}
Contract Type: ${contractType}
Start Date: ${startDate}
End Date: ${endDate}
Monthly Rent: £${monthlyRent}
Deposit: £${depositAmount}
Special Clauses: ${contract.special_clauses ?? "None"}

Include all standard AST clauses: definitions, rent payment terms, deposit protection (Tenancy Deposit Scheme), tenant obligations, landlord obligations, repair responsibilities, notice periods (Section 21, Section 8), break clauses, and termination conditions. Format as a proper legal document with numbered sections.`;

  const result = await model.generateContent(prompt);
  const contractText = result.response.text();

  const { data: action } = await supabase
    .from("agent_actions")
    .insert({
      user_id: userId,
      agent_type: "contract_drafter",
      status: "draft",
      payload: {
        contractId,
        tenantName,
        propertyAddress,
        contractType,
        contractText,
      },
    })
    .select("id")
    .single<{ id: string }>();

  return {
    contractId,
    tenantName,
    propertyAddress,
    contractType,
    startDate,
    endDate,
    monthlyRent,
    depositAmount,
    contractText,
    actionId: action?.id ?? "",
  };
}

