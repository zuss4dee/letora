"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { userFacingError } from "@/lib/user-facing-errors";

export type ContractTemplateRow = {
  id: string;
  filename: string;
  storagePath: string;
  isDefault: boolean;
  createdAt: string | null;
};

const BUCKET = "contract-templates";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadContractTemplate(formData: FormData, userId: string) {
  const supabase = await createClient();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false as const, error: "No file selected" };
  }

  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
    return { ok: false as const, error: "Only .pdf and .docx files are supported" };
  }

  const safeName = sanitizeFilename(file.name);
  const storagePath = `${userId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError)
    return {
      ok: false as const,
      error: userFacingError(uploadError.message, "We couldn't upload that template. Please try again."),
    };

  const { error: insertError } = await supabase.from("contract_templates").insert({
    user_id: userId,
    filename: file.name,
    storage_path: storagePath,
    is_default: false,
  });

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return {
      ok: false as const,
      error: userFacingError(insertError.message, "We couldn't save that template. Please try again."),
    };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true as const };
}

export async function getContractTemplates(userId: string): Promise<ContractTemplateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_templates")
    .select("id,filename,storage_path,is_default,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    filename: row.filename,
    storagePath: row.storage_path,
    isDefault: row.is_default ?? false,
    createdAt: row.created_at ?? null,
  }));
}

export async function deleteContractTemplate(templateId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: template, error: fetchError } = await supabase
    .from("contract_templates")
    .select("id,storage_path")
    .eq("id", templateId)
    .eq("user_id", user.id)
    .single<{ id: string; storage_path: string }>();

  if (fetchError || !template) return { ok: false as const, error: "Template not found" };

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([template.storage_path]);
  if (storageError)
    return {
      ok: false as const,
      error: userFacingError(storageError.message, "We couldn't read that file. Please try again."),
    };

  const { error: deleteError } = await supabase
    .from("contract_templates")
    .delete()
    .eq("id", templateId)
    .eq("user_id", user.id);

  if (deleteError)
    return {
      ok: false as const,
      error: userFacingError(deleteError.message, "We couldn't remove that template. Please try again."),
    };

  revalidatePath("/dashboard/settings");
  return { ok: true as const };
}

export async function setDefaultTemplate(templateId: string, userId: string) {
  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from("contract_templates")
    .update({ is_default: false })
    .eq("user_id", userId);
  if (clearError)
    return {
      ok: false as const,
      error: userFacingError(clearError.message, "We couldn't update defaults. Please try again."),
    };

  const { error: setError } = await supabase
    .from("contract_templates")
    .update({ is_default: true })
    .eq("id", templateId)
    .eq("user_id", userId);
  if (setError)
    return {
      ok: false as const,
      error: userFacingError(setError.message, "We couldn't set the default template. Please try again."),
    };

  revalidatePath("/dashboard/settings");
  return { ok: true as const };
}

