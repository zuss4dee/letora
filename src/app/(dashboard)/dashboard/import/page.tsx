import type { Metadata } from "next";

import { BatchOnboardingImport } from "@/components/import/batch-onboarding-import";
import { getBatchImportsForUser } from "@/lib/actions/batch-onboarding";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Batch onboarding · Letora",
  description:
    "Import a CSV of properties and tenants and let Letora onboard them in the background.",
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
