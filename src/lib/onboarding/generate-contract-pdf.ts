import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";

import { ContractPdf } from "@/components/contracts/contract-pdf";

type GenerateContractPdfParams = {
  tenantName: string;
  propertyAddress: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  contractText: string;
  landlordName?: string;
};

type GenerateContractPdfResult = {
  ok: boolean;
  documentUrl?: string;
  error?: string;
};

export async function generateContractPdf(
  supabase: SupabaseClient,
  userId: string,
  contractId: string,
  params: GenerateContractPdfParams,
): Promise<GenerateContractPdfResult> {
  try {
    const doc = ContractPdf({
      tenantName: params.tenantName,
      propertyAddress: params.propertyAddress,
      contractType: params.contractType,
      startDate: params.startDate,
      endDate: params.endDate,
      monthlyRent: params.monthlyRent,
      depositAmount: params.depositAmount,
      contractText: params.contractText,
      landlordName: params.landlordName,
    });

    const buffer = await renderToBuffer(doc);
    const pdfBuffer = Buffer.from(buffer);

    const fileName = `contract-${contractId}.pdf`;
    const storagePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase
      .storage
      .from("contract-documents")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return {
        ok: false,
        error: `Failed to upload PDF: ${uploadError.message}`,
      };
    }

    const { data: urlResult } = await supabase
      .storage
      .from("contract-documents")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    const documentUrl = urlResult?.signedUrl ?? null;

    await supabase
      .from("contracts")
      .update({ document_url: storagePath })
      .eq("id", contractId)
      .eq("user_id", userId);

    return {
      ok: true,
      documentUrl: documentUrl ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error generating PDF";
    return {
      ok: false,
      error: message,
    };
  }
}
