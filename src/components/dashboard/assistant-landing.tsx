"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function deriveTitle(firstLine: string) {
  const line = firstLine.split("\n")[0]?.trim() ?? "";
  if (!line) return "New chat";
  return line.length > 200 ? `${line.slice(0, 199)}…` : line;
}

export function AssistantLanding({
  greetingName,
  className,
}: {
  greetingName: string;
  className?: string;
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
      const res = await fetch("/api/assistant/conversations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: deriveTitle(trimmed) }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Could not start a chat.");
      }
      if (!data?.id) {
        throw new Error("Could not start a chat.");
      }
      router.push(
        `/dashboard/assistant?c=${encodeURIComponent(data.id)}&start=${encodeURIComponent(trimmed)}`,
      );
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
        <div className="flex gap-4 border-b border-[#484848]/30 bg-[#131313] px-6 py-6 transition-colors focus-within:border-[#BD9952]/50 sm:gap-5 sm:px-8">
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
        <Link
          href="/dashboard/assistant"
          className="rounded-full border border-[#484848]/30 px-5 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.1em] text-[#ACABAA] transition-all hover:border-[#BD9952]/50 hover:bg-[#BD9952]/5 hover:text-[#C9C6C5]"
        >
          All chats
        </Link>
        <Link
          href="/dashboard/settings"
          className="rounded-full border border-[#484848]/30 px-5 py-2 font-[family-name:var(--font-inter)] text-[0.6875rem] uppercase tracking-[0.1em] text-[#ACABAA] transition-all hover:border-[#BD9952]/50 hover:bg-[#BD9952]/5 hover:text-[#C9C6C5]"
        >
          Workspace settings
        </Link>
      </div>
    </section>
  );
}
