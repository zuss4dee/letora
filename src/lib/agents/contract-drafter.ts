import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

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
  tenant_id: string | null;
  property_id: string | null;
  contract_type: string | null;
  start_date: string | null;
  end_date: string | null;
  monthly_rent: number | string | null;
  deposit_amount: number | string | null;
  special_clauses: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

async function extractTemplateText(filename: string, bytes: Uint8Array): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value.trim();
  }
  if (lower.endsWith(".pdf")) {
    const result = await pdfParse(Buffer.from(bytes));
    return result.text.trim();
  }
  return new TextDecoder().decode(bytes).trim();
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

  // Fetch contract without joins
  const { data: contract } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("user_id", userId)
    .single<ContractRow>();

  if (!contract) throw new Error("Contract not found");

  // Fetch tenant separately
  const { data: tenant } = await supabase
    .from("tenant_profiles")
    .select("id, full_name, email")
    .eq("id", contract.tenant_id)
    .single<{ id: string; full_name: string | null; email: string | null }>();

  // Fetch property separately
  const { data: property } = await supabase
    .from("properties")
    .select("id, address, city")
    .eq("id", contract.property_id)
    .single<{ id: string; address: string | null; city: string | null }>();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("business_name, landlord_name")
    .eq("user_id", userId)
    .single<{ business_name: string | null; landlord_name: string | null }>();

  const businessName = settings?.business_name ?? "Letora Property Management";
  const tenantName = tenant?.full_name ?? "Unknown";
  const address = property?.address ?? "";
  const city = property?.city ?? "";
  const propertyAddress = city ? `${address}, ${city}` : address;
  const contractType = contract.contract_type ?? "Assured Shorthold Tenancy (AST)";
  const startDate = contract.start_date ?? "";
  const endDate = contract.end_date ?? "";
  const monthlyRent = toNumber(contract.monthly_rent);
  const depositAmount = toNumber(contract.deposit_amount);

  const { data: defaultTemplate } = await supabase
    .from("contract_templates")
    .select("filename,storage_path")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle<{ filename: string; storage_path: string }>();

  let templateText = "";
  if (defaultTemplate?.storage_path) {
    const { data: fileBlob } = await supabase
      .storage
      .from("contract-templates")
      .download(defaultTemplate.storage_path);

    if (fileBlob) {
      const buffer = new Uint8Array(await fileBlob.arrayBuffer());
      try {
        templateText = await extractTemplateText(defaultTemplate.filename, buffer);
      } catch {
        templateText = "";
      }
    }
  }

  const basePrompt = `You are a UK property solicitor. Draft a complete, legally-structured Assured Shorthold Tenancy Agreement for England and Wales.

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

  const prompt = templateText
    ? `${basePrompt}

Here is the landlord's existing contract template to use as a base:

${templateText}

Adapt this template for the new tenancy details, keeping the landlord's preferred structure and clauses.`
    : basePrompt;

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

