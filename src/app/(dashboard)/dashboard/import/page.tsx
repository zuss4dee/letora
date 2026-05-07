export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import { BatchOnboardingImport } from "@/components/import/batch-onboarding-import";
import { getBatchImportsForUser } from "@/lib/actions/batch-onboarding";
import { createClient } from "@/lib/supabase/server";

const IMPORT_RETRY_BATCH_UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export const metadata: Metadata = {
  title: "Portfolio Import · Letora",
  description:
    "Import your property portfolio and let agents handle the onboarding automatically.",
};

export default async function BatchImportPage({
  searchParams,
}: {
  searchParams: Promise<{ retryBatch?: string }>;
}) {
  const sp = await searchParams;
  const rawRetry = typeof sp.retryBatch === "string" ? sp.retryBatch.trim() : "";
  const retryBatchId = IMPORT_RETRY_BATCH_UUID.test(rawRetry) ? rawRetry : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const history = userId ? await getBatchImportsForUser(userId) : [];

  return <BatchOnboardingImport history={history} retryBatchId={retryBatchId} />;
}
