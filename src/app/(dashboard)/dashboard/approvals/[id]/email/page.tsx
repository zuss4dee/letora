import Link from "next/link";
import { notFound } from "next/navigation";

import { ApprovalEmailReviewClient } from "@/components/agents/approval-email-review-client";
import { getApprovalEmailReviewContext } from "@/lib/actions/approval-email-review";

export default async function ApprovalEmailReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getApprovalEmailReviewContext(id);
  if (!ctx) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <header className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard/approvals"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
          >
            ← Approvals
          </Link>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Approvals // Email review
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Review rent chase email</h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-zinc-400">
            Edit the outgoing message, then approve to send or reject to dismiss without sending.
          </p>
        </div>
      </header>

      <ApprovalEmailReviewClient ctx={ctx} />
    </div>
  );
}
