import { Suspense } from "react";
import { notFound } from "next/navigation";

import { EmailsSentRegistry } from "@/components/emails/emails-sent-registry";
import { getEmailDispatchLogs } from "@/lib/actions/email-drafts";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function EmailsDispatchContent({
  userId,
  initialLogId,
}: {
  userId: string;
  initialLogId?: string;
}) {
  const rows = await getEmailDispatchLogs(userId);
  return (
    <EmailsSentRegistry rows={rows} totalDispatched={rows.length} initialLogId={initialLogId ?? null} />
  );
}

function EmailsDispatchFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background dark:bg-[#0B0B0B]">
      <div className="border-b border-border dark:border-[#1f1f1f] px-4 py-3 sm:px-6">
        <div className="h-3 w-28 animate-pulse bg-background dark:bg-[#232323]" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col border-r border-border dark:border-[#1f1f1f]">
          <div className="h-10 border-b border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0B0B0B]" />
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={`email-shell-row-${idx}`} className="h-11 animate-pulse bg-background dark:bg-[#171717]" />
            ))}
          </div>
        </div>
        <aside className="hidden border-t border-border dark:border-[#1f1f1f] bg-background dark:bg-[#0B0B0B] xl:block xl:border-l xl:border-t-0">
          <div className="space-y-3 p-4">
            <div className="h-3 w-36 animate-pulse bg-background dark:bg-[#232323]" />
            <div className="h-20 animate-pulse bg-background dark:bg-[#171717]" />
            <div className="h-32 animate-pulse bg-background dark:bg-[#171717]" />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ logId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const sp = await searchParams;
  const raw = sp.logId;
  const initialLogId = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;

  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col bg-background dark:bg-[#0B0B0B]">
      <Suspense fallback={<EmailsDispatchFallback />}>
        <EmailsDispatchContent userId={user.id} initialLogId={initialLogId} />
      </Suspense>
    </div>
  );
}
