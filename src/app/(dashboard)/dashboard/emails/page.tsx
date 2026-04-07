import { notFound } from "next/navigation";

import { EmailsSentRegistry } from "@/components/emails/emails-sent-registry";
import { getEmailDispatchLogs } from "@/lib/actions/email-drafts";
import { createClient } from "@/lib/supabase/server";

export default async function EmailsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const rows = await getEmailDispatchLogs(user.id);

  return (
    <div className="@container/main flex flex-1 flex-col">
      <EmailsSentRegistry rows={rows} totalDispatched={rows.length} />
    </div>
  );
}
