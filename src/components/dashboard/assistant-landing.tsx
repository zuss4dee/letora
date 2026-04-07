"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

import { AgentQuickActions } from "@/components/dashboard/agent-quick-actions";
import { AssistantConversationList } from "@/components/dashboard/assistant-conversation-list";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantConversationListItem } from "@/lib/assistant-messages/store";
import { cn } from "@/lib/utils";

export function AssistantLanding({
  greetingName,
  className,
  conversations = [],
}: {
  greetingName: string;
  className?: string;
  /** Prior threads so users can continue without opening the chat view first. */
  conversations?: AssistantConversationListItem[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
  }

  return (
    <section
      className={cn(
        "flex flex-col items-center pt-8 text-center md:pt-12",
        className,
      )}
    >
      <p className="mb-4 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.2em] text-[#ACABAA]">
        Hi, {greetingName}
      </p>
      <h1 className="font-headline mb-10 max-w-4xl text-3xl font-extralight tracking-tight text-[#E7E5E4] sm:text-4xl md:text-5xl md:text-nowrap">
        What needs attention today?
      </h1>

      <form onSubmit={handleSubmit} className="w-full max-w-4xl text-left">
        <div className="flex gap-4 border-b border-[#484848]/30 bg-[#131313]/40 px-6 py-6 backdrop-blur-xl transition-colors focus-within:border-[#BD9952]/50 sm:gap-5 sm:px-8">
          <Sparkles
            className="mt-0.5 size-7 shrink-0 text-[#ACABAA] stroke-[1]"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <label htmlFor="assistant-landing-input" className="sr-only">
              Message to Letora Assistant
            </label>
            <Textarea
              id="assistant-landing-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask Letora to chase rent, draft letters, qualify a lead, or triage maintenance. Mention a property or person for live portfolio context."
              rows={3}
              disabled={busy}
              className="min-h-[5.5rem] resize-none border-0 bg-transparent p-0 font-headline text-base font-light leading-relaxed text-[#E7E5E4] shadow-none placeholder:text-[#484848] focus-visible:ring-0 sm:text-lg md:text-xl"
            />
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              {error ? (
                <p className="mr-auto font-[family-name:var(--font-inter)] text-xs text-[#BB5551]">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={busy || !text.trim()}
                className="bg-[#BD9952] text-[#2c1e00] hover:bg-[#c9a660]"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <>
                    <Send className="mr-2 size-4" aria-hidden />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <AgentQuickActions />

      {conversations.length > 0 ? (
        <div className="mt-8 w-full max-w-4xl text-left">
          <h2 className="mb-3 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.2em] text-[#ACABAA]">
            Continue a conversation
          </h2>
          <div className="max-h-[min(40vh,22rem)] overflow-y-auto rounded-xl border border-[#484848]/30 bg-[#131313]/40 backdrop-blur-xl">
            <AssistantConversationList conversations={conversations} variant="inline" />
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3 md:gap-4">
        <Link
          href="/dashboard/properties"
          className="rounded-full border border-[#484848]/30 px-5 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.1em] text-[#ACABAA] transition-all hover:border-[#BD9952]/50 hover:bg-[#BD9952]/5 hover:text-[#C9C6C5]"
        >
          Your properties
        </Link>
        <Link
          href="/dashboard/emails"
          className="rounded-full border border-[#484848]/30 px-5 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.1em] text-[#ACABAA] transition-all hover:border-[#BD9952]/50 hover:bg-[#BD9952]/5 hover:text-[#C9C6C5]"
        >
          Email inbox
        </Link>
      </div>
    </section>
  );
}
