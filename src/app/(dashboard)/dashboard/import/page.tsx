export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import { BatchOnboardingImport } from "@/components/import/batch-onboarding-import";
import { getBatchImportsForUser } from "@/lib/actions/batch-onboarding";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Portfolio Import · Letora",
  description:
    "Import your property portfolio and let agents handle the onboarding automatically.",
};

export default async function BatchImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const history = userId ? await getBatchImportsForUser(userId) : [];

  return <BatchOnboardingImport history={history} />;
}
