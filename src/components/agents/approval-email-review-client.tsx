"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { denyAgentApproval } from "@/lib/actions/agent-approvals";
import {
  approveAndSendApprovalEmail,
  saveApprovalEmailDraft,
  type ApprovalEmailReviewContext,
} from "@/lib/actions/approval-email-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function ApprovalEmailReviewClient({ ctx }: { ctx: ApprovalEmailReviewContext }) {
  const router = useRouter();
  const [subject, setSubject] = useState(ctx.subject);
  const [body, setBody] = useState(ctx.body);
  const [busy, setBusy] = useState<"none" | "save" | "approve" | "reject">("none");

  const originalSubject = ctx.originalSubject;
  const originalBody = ctx.originalBody;

  const isEdited =
    subject.trim() !== originalSubject.trim() || body.trim() !== originalBody.trim();

  const words = useMemo(() => countWords(body), [body]);

  const pound = useMemo(
    () =>
      ctx.amountOwed.toLocaleString("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 2,
      }),
    [ctx.amountOwed],
  );

  const dueLabel = ctx.dueDate && ctx.dueDate.trim() !== "" ? ctx.dueDate : "—";

  const runSaveDraft = useCallback(async () => {
    setBusy("save");
    try {
      const r = await saveApprovalEmailDraft({
        approvalId: ctx.approvalId,
        subject,
        body,
      });
      if (r.ok === false) {
        toast.error("Could not save draft", { description: r.error });
        return;
      }
      toast.success("Draft saved", { description: "Your edits are stored on this approval." });
      router.refresh();
    } catch (e) {
      toast.error("Save failed", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy("none");
    }
  }, [ctx.approvalId, subject, body, router]);

  const runApprove = useCallback(async () => {
    setBusy("approve");
    try {
      const r = await approveAndSendApprovalEmail({
        approvalId: ctx.approvalId,
        subject,
        body,
      });
      if (r.ok === false) {
        toast.error("Approve & send failed", { description: r.error });
        return;
      }
      toast.success("Approved and sent", {
        description: "Rent chase email was delivered.",
      });
      router.push("/dashboard/approvals");
    } catch (e) {
      toast.error("Something went wrong", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy("none");
    }
  }, [ctx.approvalId, subject, body, router]);

  const runReject = useCallback(async () => {
    setBusy("reject");
    try {
      const r = await denyAgentApproval(ctx.approvalId);
      if (r.ok === false) {
        toast.error("Could not reject", { description: r.error });
        return;
      }
      toast.success("Rejected", { description: "No email was sent." });
      router.push("/dashboard/approvals");
    } catch (e) {
      toast.error("Something went wrong", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy("none");
    }
  }, [ctx.approvalId, router]);

  return (
    <div className="grid min-h-0 flex-1 gap-8 bg-white dark:bg-zinc-900 lg:grid-cols-[minmax(0,1fr)_minmax(280px,38%)] lg:gap-12">
      <section className="flex min-h-0 flex-col gap-6 bg-white px-6 py-8 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-3">
          {isEdited ? (
            <span className="border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-700 dark:border-[#01696f]/50 dark:bg-[#01696f]/15 dark:text-[#97e6ec]">
              Edited
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700 dark:text-zinc-400">
            To
          </Label>
          <p className="rounded-md border border-zinc-300 bg-white px-3 py-2.5 font-mono text-[13px] text-zinc-900 dark:border-[#333] dark:bg-zinc-900 dark:text-zinc-100">
            {ctx.tenantEmail}
          </p>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="email-subject"
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700 dark:text-zinc-400"
          >
            Subject
          </Label>
          <Input
            id="email-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border border-zinc-300 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:border-[#333] dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:ring-white"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <Label
            htmlFor="email-body"
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700 dark:text-zinc-400"
          >
            Body
          </Label>
          <textarea
            id="email-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck
            className={cn(
              "min-h-[320px] w-full flex-1 resize-y rounded-md border border-zinc-300 bg-white px-3 py-3 text-[15px] leading-[1.7] text-zinc-900 shadow-none outline-none dark:border-[#333] dark:bg-zinc-900 dark:text-zinc-100",
              "font-mono placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:placeholder:text-zinc-500 dark:focus-visible:ring-white",
            )}
          />
          <p className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-500">{words} words</p>
        </div>
      </section>

      <aside className="flex flex-col gap-8 border-zinc-200 bg-zinc-50 px-6 py-8 dark:border-[#2a2a2a] dark:bg-zinc-900 lg:border-l">
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-500">
            Tenant summary
          </p>
          <dl className="space-y-3 text-[13px]">
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400">
                Name
              </dt>
              <dd className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">{ctx.tenantName}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400">
                Property
              </dt>
              <dd className="mt-1 text-zinc-800 dark:text-zinc-200">{ctx.propertyAddress}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400">
                Overdue
              </dt>
              <dd className="mt-1 tabular-nums text-zinc-800 dark:text-zinc-200">{pound}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400">
                Days late
              </dt>
              <dd className="mt-1 tabular-nums text-zinc-800 dark:text-zinc-200">{ctx.daysOverdue}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400">
                Due date
              </dt>
              <dd className="mt-1 tabular-nums text-zinc-800 dark:text-zinc-200">{dueLabel}</dd>
            </div>
          </dl>
        </div>

        <details className="group rounded-md border border-zinc-200 bg-white dark:border-[#2a2a2a] dark:bg-zinc-900">
          <summary className="cursor-pointer list-none px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              Original AI draft
              <span className="text-zinc-600 transition-colors group-open:text-zinc-500 dark:group-open:text-zinc-400">
                ▾
              </span>
            </span>
          </summary>
          <div className="space-y-3 border-t border-zinc-200 px-4 py-4 dark:border-[#2a2a2a]">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400">
                Subject
              </p>
              <p className="mt-1 text-[12px] text-zinc-800 dark:text-zinc-200">{originalSubject || "—"}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400">
                Body
              </p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                {originalBody || "—"}
              </pre>
            </div>
          </div>
        </details>

        <div className="mt-auto flex flex-col gap-2">
          <Button
            type="button"
            disabled={busy !== "none"}
            className="border border-transparent bg-zinc-900 py-6 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-zinc-700 dark:border-green-800/30 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
            onClick={() => void runApprove()}
          >
            {busy === "approve" ? "Sending…" : "Approve & send"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== "none"}
            className="border border-zinc-300 bg-transparent py-5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-700 hover:bg-zinc-100 dark:border-[#333] dark:text-zinc-300 dark:hover:bg-[#1a1a1a]"
            onClick={() => void runSaveDraft()}
          >
            {busy === "save" ? "Saving…" : "Save draft"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== "none"}
            className="border border-zinc-300 bg-transparent py-5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-[#333] dark:text-zinc-400 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
            onClick={() => void runReject()}
          >
            {busy === "reject" ? "Working…" : "Reject"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== "none"}
            className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            asChild
          >
            <Link href="/dashboard/approvals">Back to approvals</Link>
          </Button>
        </div>
      </aside>
    </div>
  );
}
