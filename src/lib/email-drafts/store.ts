import type { SupabaseClient } from "@supabase/supabase-js";

export interface EmailDraftParams {
  subject: string;
  body: string;
  tenantId?: string | null;
  tenancyId?: string | null;
  status?: string;
}

/**
 * Inserts a new record into email_drafts.
 */
export async function insertEmailDraft(
  supabase: SupabaseClient,
  userId: string,
  params: EmailDraftParams,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("email_drafts")
    .insert({
      user_id: userId,
      subject: params.subject,
      body: params.body,
      tenant_id: params.tenantId ?? null,
      tenancy_id: params.tenancyId ?? null,
      status: params.status ?? "draft",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "Failed to insert email draft" };
  }
  return { ok: true, id: data.id };
}

/**
 * Marks an existing email_draft as sent.
 */
export async function markEmailDraftSent(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("email_drafts")
    .update({ status: "sent", updated_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
