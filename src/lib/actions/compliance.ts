"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { ComplianceType } from "@/lib/compliance/types";
import { COMPLIANCE_VAULT_BUCKET, storagePathForCompliance } from "@/lib/compliance/vault";
import { getProperties } from "@/lib/actions/properties";
import { userFacingError } from "@/lib/user-facing-errors";

export type ComplianceRecordRow = {
  id: string;
  propertyId: string;
  type: ComplianceType;
  /** Empty when no expiry date (status missing). */
  expiryDate: string;
  status: "valid" | "expiring" | "expired" | "missing";
  /** Path inside `compliance-vault` bucket (not a public URL). */
  documentUrl: string | null;
  /** Optional label from upload (column may be absent on older DBs). */
  documentLabel: string | null;
};

const COMPLIANCE_TYPES: ComplianceType[] = ["EPC", "Gas Safety", "Electric Safety"];

function isComplianceType(v: string): v is ComplianceType {
  return COMPLIANCE_TYPES.includes(v as ComplianceType);
}

export async function getComplianceRecordsForUser(userId: string): Promise<ComplianceRecordRow[]> {
  const supabase = await createClient();

  const { data: properties, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .eq("user_id", userId);

  if (propErr || !properties?.length) {
    return [];
  }

  const ids = properties.map((p) => p.id as string);

  const { data: rows, error } = await supabase
    .from("compliance_records")
    .select("id, property_id, type, expiry_date, status, document_url, document_label")
    .in("property_id", ids);

  if (error) {
    console.error("[getComplianceRecordsForUser]", error.message);
    return [];
  }

  return (rows ?? []).map((r) => {
    const rawExp = (r as { expiry_date?: string | null }).expiry_date;
    const exp =
      rawExp == null || rawExp === ""
        ? ""
        : String(rawExp).slice(0, 10);
    const st = String((r as { status?: string }).status ?? "");
    const statusNorm = (["valid", "expiring", "expired", "missing"].includes(st)
      ? st
      : "valid") as ComplianceRecordRow["status"];
    const docLabel = (r as { document_label?: string | null }).document_label;
    return {
      id: r.id as string,
      propertyId: r.property_id as string,
      type: isComplianceType(String(r.type)) ? (r.type as ComplianceType) : "EPC",
      expiryDate: exp,
      status: statusNorm,
      documentUrl: ((r as { document_url?: string | null }).document_url ?? null) as string | null,
      documentLabel:
        docLabel != null && String(docLabel).trim() !== "" ? String(docLabel).trim() : null,
    };
  });
}

export type UploadComplianceDocumentResult =
  | { ok: true; documentUrl: string; signedViewUrl: string | null }
  | { ok: false; error: string };

/**
 * Uploads a PDF to `compliance-vault/{property_id}/{type}.pdf` and stores the storage path in `document_url`.
 */
export async function uploadComplianceDocument(
  propertyId: string,
  type: ComplianceType,
  formData: FormData,
): Promise<UploadComplianceDocumentResult> {
  if (!isComplianceType(type)) {
    return { ok: false, error: "Invalid compliance type." };
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return { ok: false, error: "No file provided." };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "Invalid file." };
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Only PDF files are accepted." };
  }
  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    return { ok: false, error: "File is too large (max 15 MB)." };
  }

  const hasDocumentLabel = formData.has("documentLabel");
  const labelRaw = formData.get("documentLabel");
  const documentLabel =
    typeof labelRaw === "string" && labelRaw.trim().length > 0
      ? labelRaw.trim().slice(0, 200)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (propErr || !property) {
    return { ok: false, error: "Property not found." };
  }

  const path = storagePathForCompliance(propertyId, type);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from(COMPLIANCE_VAULT_BUCKET)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
      return { ok: false, error: userFacingError(uploadErr.message, "We couldn't upload that file. Please try again.") };
  }

  const { data: existing, error: findErr } = await supabase
    .from("compliance_records")
    .select("id")
    .eq("property_id", propertyId)
    .eq("type", type)
    .maybeSingle();

  if (findErr) {
    return { ok: false, error: userFacingError(findErr.message, "We couldn't load that certificate. Please try again.") };
  }

  const now = new Date().toISOString();

  if (existing?.id) {
    const { data: updated, error: upErr } = await supabase
      .from("compliance_records")
      .update({
        document_url: path,
        updated_at: now,
        ...(hasDocumentLabel ? { document_label: documentLabel } : {}),
      })
      .eq("id", existing.id as string)
      .select("id, document_url")
      .maybeSingle();

    if (upErr) {
      return { ok: false, error: userFacingError(upErr.message, "We couldn't upload that file. Please try again.") };
    }
    const saved = String((updated as { document_url?: string } | null)?.document_url ?? "").trim();
    if (!saved || saved !== path) {
      return { ok: false, error: "Could not save document path to the database." };
    }
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("compliance_records")
      .insert({
        property_id: propertyId,
        type,
        expiry_date: null,
        document_url: path,
        ...(hasDocumentLabel ? { document_label: documentLabel } : {}),
      })
      .select("id, document_url")
      .maybeSingle();

    if (insErr) {
      return { ok: false, error: userFacingError(insErr.message, "We couldn't save that change. Please try again.") };
    }
    const saved = String((inserted as { document_url?: string } | null)?.document_url ?? "").trim();
    if (!saved || saved !== path) {
      return { ok: false, error: "Could not save document path to the database." };
    }
  }

  const { data: signed } = await supabase.storage
    .from(COMPLIANCE_VAULT_BUCKET)
    .createSignedUrl(path, 3600);

  revalidatePath("/dashboard/compliance");
  revalidatePath("/dashboard");
  return { ok: true, documentUrl: path, signedViewUrl: signed?.signedUrl ?? null };
}

/** True if any certificate row is missing a PDF or is expired — sidebar attention dot. */
export async function getComplianceSidebarAttention(userId: string): Promise<boolean> {
  const [properties, records] = await Promise.all([
    getProperties(userId),
    getComplianceRecordsForUser(userId),
  ]);
  for (const p of properties) {
    const types: ComplianceType[] = p.hasGasSupply
      ? ["EPC", "Gas Safety", "Electric Safety"]
      : ["EPC", "Electric Safety"];
    for (const type of types) {
      const rec = records.find((r) => r.propertyId === p.id && r.type === type);
      const noDoc = !rec?.documentUrl?.trim();
      const expired = rec?.status === "expired";
      if (noDoc || expired) return true;
    }
  }
  return false;
}

/** Sidebar red dot: any certificate with status expired (documents past legal date). */
export async function getComplianceExpiredSidebarAttention(userId: string): Promise<boolean> {
  const records = await getComplianceRecordsForUser(userId);
  return records.some((r) => r.status === "expired");
}

export type SignedComplianceUrlResult = { ok: true; url: string } | { ok: false; error: string };

/** Short-lived signed URL for viewing a stored PDF (private bucket). */
export async function getComplianceDocumentSignedUrl(
  propertyId: string,
  type: ComplianceType,
): Promise<SignedComplianceUrlResult> {
  if (!isComplianceType(type)) {
    return { ok: false, error: "Invalid compliance type." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (propErr || !property) {
    return { ok: false, error: "Property not found." };
  }

  const { data: row, error: rowErr } = await supabase
    .from("compliance_records")
    .select("document_url")
    .eq("property_id", propertyId)
    .eq("type", type)
    .maybeSingle();

  if (rowErr) {
    return { ok: false, error: userFacingError(rowErr.message, "We couldn't update that record. Please try again.") };
  }

  const docPath = (row as { document_url?: string | null } | null)?.document_url?.trim();
  if (!docPath) {
    return { ok: false, error: "No document uploaded for this certificate." };
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(COMPLIANCE_VAULT_BUCKET)
    .createSignedUrl(docPath, 3600);

  if (signErr || !signed?.signedUrl) {
    return {
      ok: false,
      error: userFacingError(signErr?.message, "We couldn't create a download link. Please try again."),
    };
  }

  return { ok: true, url: signed.signedUrl };
}

export type UpsertComplianceResult = { ok: true } | { ok: false; error: string };

export async function upsertComplianceRecord(
  propertyId: string,
  type: ComplianceType,
  expiryDateIso: string,
): Promise<UpsertComplianceResult> {
  if (!isComplianceType(type)) {
    return { ok: false, error: "Invalid compliance type." };
  }

  const date = expiryDateIso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Invalid date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (propErr || !property) {
    return { ok: false, error: "Property not found." };
  }

  const { data: existing, error: findErr } = await supabase
    .from("compliance_records")
    .select("id")
    .eq("property_id", propertyId)
    .eq("type", type)
    .maybeSingle();

  if (findErr) {
    return { ok: false, error: userFacingError(findErr.message, "We couldn't load that certificate. Please try again.") };
  }

  if (existing?.id) {
    const { error: upErr } = await supabase
      .from("compliance_records")
      .update({ expiry_date: date, updated_at: new Date().toISOString() })
      .eq("id", existing.id as string);

    if (upErr) {
      return { ok: false, error: userFacingError(upErr.message, "We couldn't upload that file. Please try again.") };
    }
  } else {
    const { error: insErr } = await supabase.from("compliance_records").insert({
      property_id: propertyId,
      type,
      expiry_date: date,
    });

    if (insErr) {
      return { ok: false, error: userFacingError(insErr.message, "We couldn't save that change. Please try again.") };
    }
  }

  revalidatePath("/dashboard/compliance");
  return { ok: true };
}
