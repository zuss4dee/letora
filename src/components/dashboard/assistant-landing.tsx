"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { AgentQuickActions } from "@/components/dashboard/agent-quick-actions";
import { AssistantConversationList } from "@/components/dashboard/assistant-conversation-list";
import { WorkspaceSetupReminder } from "@/components/dashboard/workspace-setup-reminder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantConversationListItem } from "@/lib/assistant-messages/store";
import type { WorkspaceSetupPendingItem } from "@/lib/onboarding/workspace-setup";
import { cn } from "@/lib/utils";

export function AssistantLanding({
  greetingName,
  className,
  conversations = [],
  totalProperties,
  activeTenancies,
  workspaceSetupChecklist = [],
}: {
  greetingName: string;
  className?: string;
  conversations?: AssistantConversationListItem[];
  /** High-level portfolio counts — home dashboard only. */
  totalProperties?: number;
  activeTenancies?: number;
  /** Bottom-of-page setup to-do — incomplete tasks only; each disappears as it’s completed. */
  workspaceSetupChecklist?: WorkspaceSetupPendingItem[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      router.push(`/dashboard?q=${encodeURIComponent(trimmed)}`);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [busy, router, text]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runSubmit();
  }

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    e.currentTarget.blur();
    void runSubmit();
  }

  return (
    <section
      className={cn(
        "flex flex-col items-stretch pt-2 text-left md:pt-4",
        className,
      )}
    >
      <p className="font-headline text-[0.65rem] font-medium uppercase tracking-[0.28em] text-muted-foreground">
        {greetingName}
      </p>
      {typeof totalProperties === "number" && typeof activeTenancies === "number" ? (
        <div
          className="mt-4 border-b border-border/60 pb-4 md:mt-6 md:pb-6"
          data-mercury-tour="portfolio"
        >
          <p className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Portfolio snapshot
          </p>
          <div className="mt-3 flex flex-wrap gap-4 md:mt-4 md:gap-8">
          <div>
            <p className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Total properties
            </p>
            <p className="mt-1 font-headline text-xl font-extralight tabular-nums text-foreground md:mt-1.5 md:text-2xl">
              {totalProperties}
            </p>
          </div>
          <div>
            <p className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Active tenancies
            </p>
            <p className="mt-1 font-headline text-xl font-extralight tabular-nums text-foreground md:mt-1.5 md:text-2xl">
              {activeTenancies}
            </p>
          </div>
          </div>
        </div>
      ) : null}
      <h1
        className={cn(
          "font-headline text-xl font-extralight leading-[1.15] tracking-[-0.03em] text-foreground sm:text-2xl md:text-3xl",
          typeof totalProperties === "number" && typeof activeTenancies === "number" ? "mt-5 md:mt-8" : "mt-4 md:mt-6",
        )}
      >
        What needs attention?
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 w-full md:mt-10" data-mercury-tour="assistant-input">
        <div className="rounded-2xl border border-border bg-card p-1 shadow-sm transition-[border-color,box-shadow] duration-200 ease-out dark:border-white/[0.08] dark:bg-[#111]/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="rounded-[0.875rem] bg-background px-5 py-5 transition-colors duration-200 ease-out sm:px-6 sm:py-6 dark:bg-[#0d0d0d]">
            <label htmlFor="assistant-landing-input" className="sr-only">
              Message to Letora Assistant
            </label>
            <Textarea
              id="assistant-landing-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onTextareaKeyDown}
              placeholder="Rent, maintenance, tenants, contracts, or leads — name a property or person."
              rows={3}
              disabled={busy}
              className="min-h-[5rem] resize-none border-0 bg-transparent p-0 font-headline text-[0.9375rem] font-light leading-[1.6] text-foreground shadow-none placeholder:text-placeholder-foreground transition-[color,background-color] duration-200 ease-out focus-visible:ring-0 sm:text-base"
            />
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4 transition-colors duration-200">
              {error ? (
                <p className="mr-auto font-headline text-xs font-normal text-destructive">{error}</p>
              ) : null}
              <Button
                type="submit"
                disabled={busy || !text.trim()}
                className="h-10 rounded-full bg-[#BD9952] px-6 font-headline text-xs font-semibold uppercase tracking-[0.14em] text-[#1f1608] transition-colors duration-200 ease-out hover:bg-[#c4a45e]"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <>
                    <Send className="mr-2 size-3.5 opacity-90" aria-hidden />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-3 hidden font-headline text-[0.65rem] text-muted-foreground md:block">
          Enter to send · Shift+Enter for a new line
        </p>
      </form>

      <AgentQuickActions />

      {conversations.length > 0 ? (
        <div className="mt-12 w-full">
          <h2 className="font-headline text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Recent
          </h2>
          <div className="mt-3 max-h-[min(38vh,20rem)] overflow-y-auto rounded-xl border border-border bg-muted/30 dark:bg-[#101010]">
            <AssistantConversationList conversations={conversations} variant="inline" />
          </div>
        </div>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-2">
        <Link
          href="/dashboard/properties"
          className="rounded-full border border-border px-4 py-2 font-headline text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-200 ease-out hover:border-secondary/50 hover:bg-muted/50 hover:text-foreground"
        >
          Properties
        </Link>
        <Link
          href="/dashboard/emails"
          className="rounded-full border border-border px-4 py-2 font-headline text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-200 ease-out hover:border-secondary/50 hover:bg-muted/50 hover:text-foreground"
        >
          Emails
        </Link>
      </div>

      {workspaceSetupChecklist.length > 0 ? (
        <WorkspaceSetupReminder items={workspaceSetupChecklist} className="mt-12" />
      ) : null}
    </section>
  );
}
