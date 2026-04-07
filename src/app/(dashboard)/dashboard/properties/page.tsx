export const dynamic = "force-dynamic";

import { ManagedPropertiesRegistry } from "@/components/properties/managed-properties-registry";
import { getPropertiesPortfolio } from "@/lib/actions/properties";
import { createClient } from "@/lib/supabase/server";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const rows = userId ? await getPropertiesPortfolio(userId) : [];

  return <ManagedPropertiesRegistry rows={rows} />;
}
